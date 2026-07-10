// Shared helpers for the DevSecOps security suite.
//
// These tests exercise the REAL Supabase project referenced by the env
// vars, because data isolation in this app is enforced by Postgres
// Row-Level Security — the only faithful way to test it is against actual
// policies with real user JWTs. Every user/row created here is disposable
// and removed in the suite's after() cleanup.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");

/** Parse .env.local (KEY="value" / KEY=value), tolerating a BOM-prefixed value. */
function parseEnvFile(file) {
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return {};
  }
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    value = value.replace(/﻿/g, "").trim(); // strip BOM anywhere
    out[key] = value;
  }
  return out;
}

export function loadEnv() {
  const fileEnv = parseEnvFile(path.join(REPO_ROOT, ".env.local"));
  const get = (k) => process.env[k] || fileEnv[k];

  const url = get("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceKey = get("SUPABASE_SERVICE_ROLE_KEY");

  const missing = [
    ["NEXT_PUBLIC_SUPABASE_URL", url],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceKey],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    throw new Error(
      `Security tests need these env vars (in .env.local or the environment): ${missing.join(", ")}`,
    );
  }
  return { url, anonKey, serviceKey };
}

/** Service-role client — bypasses RLS. Setup/cleanup ONLY, never the assertions. */
export function adminClient({ url, serviceKey }) {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Fresh anonymous client (no persisted session). */
export function anonClient({ url, anonKey }) {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const randomEmail = (tag = "sec") =>
  `sectest+${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

/** Create a confirmed user via the admin API (does not hit the sign-in rate limiter). */
export async function createUser(admin, email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  return data.user;
}

/**
 * Sign a user in and return their AUTHED client (RLS applies as that user).
 * Retries on 429 because the sign-in endpoint is rate-limited (short window)
 * and the brute-force test — or a prior run — may have consumed budget.
 */
export async function signInAs(env, email, password, { maxRetries = 8 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const client = anonClient(env);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (!error && data.session) return client;
    if (error && error.status === 429) {
      await sleep(3000 * (attempt + 1)); // linear backoff on rate limit
      continue;
    }
    throw new Error(`signIn failed for ${email}: ${error?.message ?? "no session"}`);
  }
  throw new Error(`signIn for ${email} kept hitting the rate limit`);
}

/** Delete a user's rows (service role) then the user. Best-effort, never throws. */
export async function cleanupUser(admin, userId) {
  if (!userId) return;
  for (const table of ["exports", "payments", "clip_segments", "lyrics", "songs"]) {
    await admin.from(table).delete().eq("user_id", userId);
  }
  await admin.from("profiles").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId).catch(() => {});
}

export { sleep };
