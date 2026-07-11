-- Founder comp access + one free song per user.

-- Founder/comp flag: when true, every song is free for this account (QA and
-- staff). Set only by trusted server code — see the grant lockdown below.
alter table profiles
  add column if not exists is_founder boolean not null default false;

-- The single free song a user has "claimed" (their first downloaded song).
-- Plain uuid, NO foreign key on purpose: once claimed we never want the
-- freebie to reopen. An FK with `on delete set null` would let a user delete
-- the claimed song and grab a fresh free one; a non-null value here is a
-- permanent "freebie used" marker.
alter table profiles
  add column if not exists free_song_id uuid;

-- Privilege lockdown. is_founder and free_song_id must be writable ONLY by the
-- service-role client (Stripe webhook / download-route claim), never by a
-- user's own session — otherwise anyone could self-promote to founder or
-- rotate their free song to unlock everything.
--
-- In Postgres a table-level UPDATE/INSERT grant supersedes column grants, and
-- Supabase grants the client roles table-level ALL by default. So we drop the
-- table-level insert/update from the client roles and re-grant only the
-- columns a user may legitimately write to their own row. RLS
-- (profiles_insert_own / profiles_update_own) still restricts writes to the
-- caller's own row; the service_role bypasses all of this.
revoke insert, update on profiles from anon, authenticated;
grant insert (id, display_name, updated_at) on profiles to authenticated;
grant update (display_name, updated_at) on profiles to authenticated;
