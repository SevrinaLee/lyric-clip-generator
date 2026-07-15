-- Creator subscription (v1.5 Sprint 5.2). A single active/trialing row unlocks
-- EVERY song for the user (enforced in lib/access.ts's evaluateSongAccess, the
-- single access chokepoint). Written ONLY by the Stripe webhook (service-role
-- client); owner read-only, so a client can't grant itself a subscription.
create table if not exists subscriptions (
  id text primary key,                      -- Stripe subscription id (sub_...)
  user_id uuid references auth.users not null,
  stripe_customer_id text not null,
  status text not null,                     -- active | trialing | past_due | canceled | ...
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on subscriptions(user_id);

alter table subscriptions enable row level security;

-- Owner read-only (to reflect plan status in the UI). No write policies: only
-- the service-role webhook writes, so subscriptions can't be forged.
drop policy if exists "subscriptions_read" on subscriptions;
create policy "subscriptions_read" on subscriptions
  for select using (auth.uid() = user_id);
