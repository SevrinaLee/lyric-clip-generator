-- Stores each user's Stripe customer id so the billing portal (and future
-- checkouts) can look it up. Written by the Stripe webhook via the
-- service-role client (see lib/supabase/admin.ts) — a webhook request has
-- no user session, so it can't satisfy the auth.uid() = id check below;
-- that check is what stops OTHER users from reading/writing it.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles_read_own" on profiles;
create policy "profiles_read_own" on profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);
