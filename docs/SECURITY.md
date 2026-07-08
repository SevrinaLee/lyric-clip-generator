# Security — Lyric Clip Generator

## Secret Handling
- `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` live in Vercel environment variables only — never in client bundles or Supabase client config
- Supabase `service_role` key used only in Edge Functions and server-side API routes — never exposed to the browser
- Stripe publishable key is the only payment key safe for the frontend

## Permission Model (v1 → Lock-down)
- **v1**: RLS policies are permissive (`using (true)`) so demo runs without auth
- **Lock-down sprint**: All tables switch to `auth.uid() = user_id`; anonymous access revoked
- Stripe webhook endpoint validates `stripe-signature` header before any DB write
- Exports are served via signed Supabase Storage URLs (60-min expiry) — never public permanent URLs

## Approved-Tools Rule
Agents may only call the named tools listed in `AGENTIC_LAYER.md`. No `eval`, no `run_any`, no dynamic tool construction. Every tool call is logged to `audit_logs`.

## Audit Principle
Every meaningful state change (segment scored, payment initiated, export triggered, download served) writes an `audit_logs` row with actor, action, object, and outcome. Logs are append-only; no row is ever updated or deleted.
