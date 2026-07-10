// DevSecOps verification suite (see CLAUDE.md § DevSecOps).
//
// Four mandatory categories, all executed against the real Supabase project
// and its RLS policies:
//   1. Data isolation          — User B cannot read/modify User A's data
//   2. SQL-injection prevention — raw payloads are treated as literal data
//   3. Brute-force defenses     — rapid failed sign-ins get rate-limited
//   4. Data-exfiltration prevention — only own + intended fields are returned
//
// Run: npm run test:security   (or: node --test tests/security/)

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  adminClient,
  anonClient,
  cleanupUser,
  createUser,
  loadEnv,
  randomEmail,
  signInAs,
} from "./helpers.mjs";

const env = loadEnv();
const admin = adminClient(env);

const PASSWORD = "Correct-Horse-9!";
const ctx = {
  a: { user: null, client: null, songId: null, paymentId: null },
  b: { user: null, client: null, songId: null },
  anon: anonClient(env),
};

before(async () => {
  // Two disposable users, each with their own private data owned by A.
  const emailA = randomEmail("a");
  const emailB = randomEmail("b");

  ctx.a.user = await createUser(admin, emailA, PASSWORD);
  ctx.b.user = await createUser(admin, emailB, PASSWORD);
  ctx.a.client = await signInAs(env, emailA, PASSWORD);
  ctx.b.client = await signInAs(env, emailB, PASSWORD);

  // A owns a private song + a paid payment.
  const { data: song, error: songErr } = await ctx.a.client
    .from("songs")
    .insert({
      user_id: ctx.a.user.id,
      title: "A private song",
      artist: "Alice",
      status: "ready",
    })
    .select("id")
    .single();
  assert.equal(songErr, null, "setup: A should be able to insert own song");
  ctx.a.songId = song.id;

  const { data: payment, error: payErr } = await ctx.a.client
    .from("payments")
    .insert({
      user_id: ctx.a.user.id,
      song_id: ctx.a.songId,
      amount_cents: 499,
      status: "paid",
      plan: "single",
    })
    .select("id")
    .single();
  assert.equal(payErr, null, "setup: A should be able to insert own payment");
  ctx.a.paymentId = payment.id;

  // A profile carries a sensitive field we must ensure never leaks to B.
  await admin.from("profiles").upsert({
    id: ctx.a.user.id,
    display_name: "Alice",
    stripe_customer_id: "cus_SECRET_A",
  });

  // B has a private song of their own (for the exfiltration cross-check).
  const { data: bSong } = await ctx.b.client
    .from("songs")
    .insert({
      user_id: ctx.b.user.id,
      title: "B private song",
      artist: "Bob",
      status: "ready",
    })
    .select("id")
    .single();
  ctx.b.songId = bSong?.id ?? null;
  await ctx.b.client
    .from("profiles")
    .upsert({ id: ctx.b.user.id, display_name: "Bob" });
});

after(async () => {
  await cleanupUser(admin, ctx.a.user?.id);
  await cleanupUser(admin, ctx.b.user?.id);
});

// ── 1. DATA ISOLATION ───────────────────────────────────────────────────────
describe("1. Data isolation (User B cannot reach User A's data)", () => {
  it("positive control: A can read own song", async () => {
    const { data } = await ctx.a.client
      .from("songs")
      .select("id")
      .eq("id", ctx.a.songId);
    assert.equal(data?.length, 1, "A must see their own song");
  });

  it("B gets zero rows reading A's song (RLS hides it)", async () => {
    const { data } = await ctx.b.client
      .from("songs")
      .select("*")
      .eq("id", ctx.a.songId);
    assert.equal(data?.length ?? 0, 0, "B must not see A's song");
  });

  it("B cannot UPDATE A's song", async () => {
    const { data } = await ctx.b.client
      .from("songs")
      .update({ title: "hacked by B" })
      .eq("id", ctx.a.songId)
      .select();
    assert.equal(data?.length ?? 0, 0, "update must affect zero rows");

    const { data: check } = await admin
      .from("songs")
      .select("title")
      .eq("id", ctx.a.songId)
      .single();
    assert.equal(check.title, "A private song", "A's title must be unchanged");
  });

  it("B cannot DELETE A's song", async () => {
    const { data } = await ctx.b.client
      .from("songs")
      .delete()
      .eq("id", ctx.a.songId)
      .select();
    assert.equal(data?.length ?? 0, 0, "delete must affect zero rows");

    const { count } = await admin
      .from("songs")
      .select("id", { count: "exact", head: true })
      .eq("id", ctx.a.songId);
    assert.equal(count, 1, "A's song must still exist");
  });

  it("B cannot read A's payment", async () => {
    const { data } = await ctx.b.client
      .from("payments")
      .select("*")
      .eq("id", ctx.a.paymentId);
    assert.equal(data?.length ?? 0, 0, "B must not see A's payment");
  });

  it("anonymous user cannot read A's private song", async () => {
    const { data } = await ctx.anon
      .from("songs")
      .select("*")
      .eq("id", ctx.a.songId);
    assert.equal(data?.length ?? 0, 0, "anon must not see private songs");
  });
});

// ── 2. SQL-INJECTION PREVENTION ─────────────────────────────────────────────
// Two layers protect this app: (a) all queries go through the parameterized
// PostgREST/Supabase builder, so a payload can only ever be literal data;
// (b) a Cloudflare WAF in front of Supabase blocks blatantly malicious
// request bodies (e.g. containing `DROP TABLE`) before they even arrive.
// The suite proves (a) directly and confirms (b) as defense-in-depth.
describe("2. SQL-injection prevention (payloads treated as literal data)", () => {
  // Injection attempts that are NOT DDL, so they reach the DB layer and let
  // us prove the query builder parameterizes them (returns nothing).
  const NON_DDL_PAYLOADS = [
    "' OR '1'='1",
    '" OR 1=1 --',
    "admin'--",
    "1 OR 1=1",
    "') OR ('1'='1",
  ];

  it("injection payloads in an eq() filter fail safely (blocked OR empty)", async () => {
    let blockedByWaf = 0;
    let parameterizedEmpty = 0;
    for (const payload of NON_DDL_PAYLOADS) {
      const { data, error } = await ctx.a.client
        .from("songs")
        .select("*")
        .eq("title", payload);
      // Fail-safe means exactly one of: rejected before the DB (WAF error),
      // or reached the DB and matched nothing (parameterized as literal).
      // What must NEVER happen: rows come back.
      if (error) {
        blockedByWaf++;
      } else {
        assert.equal(
          data?.length ?? 0,
          0,
          `payload leaked rows (injection succeeded!): ${payload}`,
        );
        parameterizedEmpty++;
      }
    }
    assert.equal(
      blockedByWaf + parameterizedEmpty,
      NON_DDL_PAYLOADS.length,
      "every payload must be accounted for as blocked or empty",
    );
    console.log(
      `    ↳ ${NON_DDL_PAYLOADS.length} payloads: ${blockedByWaf} WAF-blocked, ${parameterizedEmpty} parameterized-empty`,
    );
  });

  it("injection in a text filter (ilike) fails safely", async () => {
    const { data, error } = await ctx.a.client
      .from("songs")
      .select("*")
      .ilike("title", "%' OR 1=1--%");
    // Blocked by WAF (error) or reached the DB and matched nothing — both safe.
    if (!error) {
      assert.ok(Array.isArray(data), "must return a normal result set");
      assert.equal(data.length, 0, "no rows should match the literal pattern");
    }
  });

  it("an injection string is stored and returned as a literal value", async () => {
    const literal = "' OR '1'='1"; // classic injection, harmless as literal
    const { data: inserted, error } = await ctx.a.client
      .from("songs")
      .insert({
        user_id: ctx.a.user.id,
        title: literal,
        artist: "Alice",
        status: "ready",
      })
      .select("id, title")
      .single();
    assert.equal(error, null, "insert of a literal payload must succeed");
    assert.equal(inserted.title, literal, "title stored verbatim, not executed");
    await admin.from("songs").delete().eq("id", inserted.id);
  });

  it("a DDL payload cannot drop a table (WAF-blocked or stored literally)", async () => {
    const ddl = "'; DROP TABLE songs;--";
    const { error } = await ctx.a.client
      .from("songs")
      .insert({
        user_id: ctx.a.user.id,
        title: ddl,
        artist: "Alice",
        status: "ready",
      })
      .select("id")
      .maybeSingle();

    // Either outcome is safe: the WAF rejects it (error) OR it's stored as a
    // literal. What must NEVER happen is the DROP executing. Prove the table
    // still exists and is queryable afterward.
    const { error: stillThere, count } = await admin
      .from("songs")
      .select("id", { count: "exact", head: true });
    assert.equal(stillThere, null, "songs table must still exist");
    assert.ok(typeof count === "number", "songs table must still be queryable");

    // If it slipped past the WAF and was stored, clean it up.
    if (!error) await admin.from("songs").delete().eq("title", ddl);
  });
});

// ── 4. DATA-EXFILTRATION PREVENTION ─────────────────────────────────────────
// (ordered before brute-force so the rate-limit test runs last)
describe("4. Data-exfiltration prevention (no bulk or unintended leakage)", () => {
  it("unfiltered songs select returns only own + public rows", async () => {
    const { data } = await ctx.b.client.from("songs").select("id, user_id");
    assert.ok(Array.isArray(data));
    for (const row of data) {
      assert.ok(
        row.user_id === null || row.user_id === ctx.b.user.id,
        `B leaked a foreign row: ${row.id} (owner ${row.user_id})`,
      );
    }
    assert.ok(
      !data.some((r) => r.id === ctx.a.songId),
      "A's private song must not appear in B's unfiltered list",
    );
  });

  it("profiles never expose another user's row or stripe id", async () => {
    const { data } = await ctx.b.client.from("profiles").select("*");
    assert.ok(Array.isArray(data));
    assert.ok(
      !data.some((r) => r.id === ctx.a.user.id),
      "A's profile must not be visible to B",
    );
    const serialized = JSON.stringify(data);
    assert.ok(
      !serialized.includes("cus_SECRET_A"),
      "A's stripe_customer_id must never leak to B",
    );
  });

  it("anonymous users can only see public (null-owner) rows", async () => {
    const { data } = await ctx.anon.from("songs").select("id, user_id");
    assert.ok(Array.isArray(data));
    for (const row of data) {
      assert.equal(
        row.user_id,
        null,
        `anon leaked a private row: ${row.id} (owner ${row.user_id})`,
      );
    }
  });

  it("payments do not leak across users", async () => {
    const { data } = await ctx.b.client.from("payments").select("*");
    assert.ok(!(data ?? []).some((p) => p.id === ctx.a.paymentId));
  });
});

// ── 3. BRUTE-FORCE DEFENSES ─────────────────────────────────────────────────
// Runs LAST: it deliberately consumes the IP's sign-in budget.
describe("3. Brute-force defenses (rapid failed sign-ins are throttled)", () => {
  it("a burst of wrong-password attempts triggers HTTP 429", async () => {
    const target = randomEmail("brute"); // never a real account
    const MAX_ATTEMPTS = 45; // calibrated: limiter trips well under this
    const statusCounts = {};
    let firstRateLimitedAt = -1;
    let anySessionIssued = false;

    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      const res = await fetch(`${env.url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: env.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email: target, password: `wrong-${i}` }),
      });
      statusCounts[res.status] = (statusCounts[res.status] ?? 0) + 1;
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.access_token) anySessionIssued = true;
      }
      if (res.status === 429) {
        firstRateLimitedAt = i;
        break;
      }
    }

    assert.equal(
      anySessionIssued,
      false,
      "no wrong-password attempt may ever return a session token",
    );
    assert.ok(
      firstRateLimitedAt > 0,
      `rate limiting must engage within ${MAX_ATTEMPTS} attempts; got ${JSON.stringify(statusCounts)}`,
    );
    console.log(
      `    ↳ rate limit engaged at attempt ${firstRateLimitedAt} (statuses: ${JSON.stringify(statusCounts)})`,
    );
  });
});
