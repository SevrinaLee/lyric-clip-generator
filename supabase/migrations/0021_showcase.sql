-- Public showcase gallery (v1.6 Sprint 6.1). The FIRST deliberately-public
-- user content, so the RLS is the crux:
--   * anyone (incl. anon) may read rows that are APPROVED
--   * an owner may read their own rows (approved or pending)
--   * an owner may opt IN (insert) — but can NOT set approved themselves
--   * an owner may withdraw (delete) their own entry
--   * there is NO update policy, so `approved` can only be flipped by the
--     service role / SQL editor (manual curation) — users can't self-publish
-- Only export references are stored; deleting the export cascades the entry.
create table if not exists showcase_entries (
  id uuid primary key default gen_random_uuid(),
  export_id uuid not null references exports(id) on delete cascade,
  user_id uuid references auth.users not null,
  title text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists showcase_entries_approved_idx on showcase_entries(approved);

alter table showcase_entries enable row level security;

drop policy if exists "showcase_read" on showcase_entries;
create policy "showcase_read" on showcase_entries
  for select using (approved = true or auth.uid() = user_id);

-- Insert own rows only, as UNAPPROVED (no instant self-publish), and only for
-- an export the caller actually owns (can't submit someone else's clip).
drop policy if exists "showcase_insert" on showcase_entries;
create policy "showcase_insert" on showcase_entries
  for insert with check (
    auth.uid() = user_id
    and approved = false
    and exists (
      select 1 from exports
      where exports.id = export_id and exports.user_id = auth.uid()
    )
  );

drop policy if exists "showcase_delete" on showcase_entries;
create policy "showcase_delete" on showcase_entries
  for delete using (auth.uid() = user_id);
