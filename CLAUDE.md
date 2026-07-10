# Project conventions

## Stack
- **Next.js 15** App Router, React 19, TypeScript strict
- **Tailwind v4** — CSS-first config in `app/globals.css` (no `tailwind.config.ts`)
- **Supabase** via `@supabase/ssr` (cookie-based sessions)
- **Bun** package manager

## Supabase client patterns
| Context | Import from |
|---|---|
| Client component | `lib/supabase/client.ts` |
| Server component / Route handler / Server action | `lib/supabase/server.ts` |
| Middleware | `lib/supabase/middleware.ts` |

- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the browser
- **Never** use deprecated `@supabase/auth-helpers-nextjs`
- Server components are default — add `"use client"` only when needed
- Use Server Actions for mutations (prefer over `/api` routes)

## Path aliases
`@/*` → repo root

## Stripe payments

### Two modes — controlled by env vars only, no code changes
- **Standalone:** set `STRIPE_SECRET_KEY`. Platform vars are empty.
- **Platform (via Vibe Launchpad):** `STRIPE_CONNECT_ACCOUNT_ID` + `STRIPE_PLATFORM_FEE_PERCENT` are injected at provisioning time. Platform takes a cut automatically.

### API routes
| Route | Method | Purpose |
|---|---|---|
| `/api/stripe/checkout` | POST `{ priceId }` | Create Checkout Session, returns `{ url }` |
| `/api/stripe/portal` | POST | Billing portal for subscription management |
| `/api/stripe/webhooks` | POST | Stripe webhook handler (verify + process events) |

### Required Supabase tables
Run in Supabase SQL Editor before using payments:
```sql
-- Store Stripe customer ID on profiles
alter table profiles add column if not exists stripe_customer_id text;

-- Subscriptions (updated by webhook)
create table subscriptions (
  id text primary key,
  user_id uuid references auth.users not null,
  stripe_customer_id text not null,
  status text not null,
  price_id text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table subscriptions enable row level security;
create policy "Users see own subscription"
  on subscriptions for select using (auth.uid() = user_id);

-- One-time purchases
create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  stripe_customer_id text,
  stripe_session_id text,
  amount_total integer,
  status text,
  created_at timestamptz default now()
);
alter table purchases enable row level security;
create policy "Users see own purchases"
  on purchases for select using (auth.uid() = user_id);
```

### Local webhook testing
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhooks
```

### Usage in a Server Action
```typescript
"use server";
import { redirect } from "next/navigation";

export async function subscribe(priceId: string) {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    body: JSON.stringify({ priceId }),
  });
  const { url } = await res.json();
  redirect(url);
}
```

## DevSecOps — security is not optional

Security must be built into every change touching **code, authentication, or
data** — not bolted on afterward. Default to the secure option (parameterized
queries, RLS-enforced access, least-privilege keys, server-side validation)
even when the user didn't explicitly ask.

### How this app's defenses are actually enforced
- **Data isolation** is enforced by Postgres **Row-Level Security**, not by app
  code alone. Every user-owned table (`songs`, `lyrics`, `clip_segments`,
  `payments`, `exports`, `profiles`) has RLS enabled with `auth.uid() = user_id`
  (or `= id`) policies. See `supabase/migrations/0004_lockdown_rls.sql`,
  `0005_profiles.sql`, `0007_profile_display_name.sql`. Adding a new
  user-scoped table **requires** an accompanying RLS migration in the same change.
- The **service-role key bypasses RLS** and must never reach the browser or a
  request that carries a user session. It is used only server-to-server in
  `lib/supabase/admin.ts` (Stripe webhook), authenticated by the Stripe signature.
- **SQL injection** is prevented by only ever going through the Supabase client
  query builder / parameterized RPC — never string-concatenated SQL. The
  Management API (`/database/query`) is for migrations/ops only, never fed
  user input.
- **Mutations** run through Server Actions / route handlers that re-check
  `supabase.auth.getUser()` server-side; never trust a client-supplied `user_id`.

### Mandatory verification before calling any security-relevant change "done"
Write **and execute** automated tests (do not just describe them) covering:
1. **Data isolation** — sign in as User A and request User B's resource
   (e.g. `GET`/Server Action for B's song, payment, or profile); assert a
   403/404 / empty result, never B's data.
2. **SQL-injection prevention** — submit raw payloads (`' OR '1'='1`,
   `'; drop table songs;--`, etc.) into every user-facing input/endpoint;
   assert they are treated as literal data and fail safely (no error leak,
   no unintended rows).
3. **Brute-force defenses** — simulate rapid repeated login attempts; assert
   rate-limiting / lockout triggers. (Supabase Auth rate-limits sign-in
   server-side; verify it engages and document the threshold. If a custom
   endpoint lacks throttling, add it.)
4. **Data-exfiltration prevention** — assert list/detail responses return only
   the caller's rows and only intended fields (no bulk dumps, no leaking
   `stripe_customer_id`, service keys, other users' emails, internal columns).

These live in **`tests/security/`** (run: `npm run test:security`) and run in CI
on every push/PR to `main` via `.github/workflows/security-tests.yml`. Extend
that suite when adding new tables/endpoints — don't hand-verify. **Report
detailed results only after all four verification categories have been executed
and pass** — state what was run, the payloads/scenarios used, and the outcomes.

Established facts (keep the suite honest about them):
- **Injection has two layers:** a Cloudflare WAF in front of Supabase blocks
  blatant payloads (`DROP TABLE`, `OR 1=1`) outright, and anything that slips
  past is parameterized by the PostgREST builder. "Fails safely" = blocked OR
  returned zero rows.
- **Brute-force throttling is Supabase Auth's**, not app code: rapid failed
  sign-ins from one IP hit HTTP 429 at ~27–30 attempts, short reset window.

## gstack workflow
This repo uses [gstack](https://github.com/garrytan/gstack):
- **Plan:** `/office-hours` → `/autoplan`
- **Review:** `/review` before merging
- **Ship:** `/ship` (bumps version, opens PR)
- **Deploy:** `/land-and-deploy` after PR merge
- **QA:** `/qa <preview-url>` on every deploy
- **Security audit:** `/cso` before going public
