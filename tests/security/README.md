# Security test suite

Automated verification of the four DevSecOps requirements in
[`CLAUDE.md`](../../CLAUDE.md) § DevSecOps. These tests run against the **real
Supabase project** (from `.env.local` or CI secrets), because this app's data
isolation is enforced by Postgres Row-Level Security — the only faithful way to
test it is with real user JWTs against the actual policies.

## Run it

```bash
npm run test:security
```

Needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` (read from `.env.local`, or the environment in CI).
Every user and row it creates is disposable and removed in the suite's cleanup;
a run leaves the project exactly as it found it.

In CI it runs on every push/PR to `main` via
[`.github/workflows/security-tests.yml`](../../.github/workflows/security-tests.yml)
(add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` as repo
secrets).

## What it covers

| # | Category | What it asserts |
|---|---|---|
| 1 | **Data isolation** | User B gets zero rows / zero-affected on User A's song, payment, and profile (read, update, delete); anonymous users can't read private rows. |
| 2 | **SQL-injection prevention** | Raw payloads (`' OR '1'='1`, `'; DROP TABLE songs;--`, …) fail safely — either blocked by the Cloudflare WAF in front of Supabase, or reach the DB and are treated as literal data (zero rows / stored verbatim). The `songs` table survives a DDL payload. |
| 3 | **Brute-force defenses** | A burst of wrong-password sign-ins triggers HTTP 429 (rate limiting engages ~27–30 attempts per IP), and no wrong attempt ever returns a session. |
| 4 | **Data-exfiltration prevention** | Unfiltered/list queries return only the caller's own rows plus public demo rows; other users' emails and `stripe_customer_id` never leak. |

## Notes / findings

- **Two injection layers.** Supabase sits behind a Cloudflare WAF that blocks
  obvious payloads (`DROP TABLE`, `OR 1=1`) outright; anything that slips past
  is still parameterized by the PostgREST query builder. The suite treats both
  outcomes as safe and logs which layer caught each payload.
- **Brute-force is enforced by Supabase Auth**, not app code — the rate-limit
  window is short (resets in well under a minute), so the test doesn't lock the
  IP out for long. The test runs last because it deliberately consumes the
  IP's sign-in budget.
