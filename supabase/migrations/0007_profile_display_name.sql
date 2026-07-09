-- Editable display name / nickname on the profile page.
alter table profiles
  add column if not exists display_name text;

-- 0005 only added select/update policies (rows were created solely by the
-- Stripe webhook via the service-role client). Now that users save their
-- own display name, they need to be able to create their own row too.
drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);
