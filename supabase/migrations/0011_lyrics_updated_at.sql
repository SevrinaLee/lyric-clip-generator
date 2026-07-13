-- Track when a lyric line was last edited, so the UI can tell when a
-- previously-rendered clip has gone stale (its baked timing predates a later
-- lyric/timing edit) and prompt the user to refresh the downloadable clip.
--
-- App-managed, matching the profiles.updated_at convention in this repo: the
-- timing-update server actions set updated_at = now() explicitly. Existing
-- rows and future inserts get now() via the default. lyrics already has
-- owner-scoped RLS (0004) and no column-level grant lockdown (only profiles
-- were locked in 0008), so authenticated owners can write this column.
alter table lyrics
  add column if not exists updated_at timestamptz not null default now();

-- Backfill: the default now() stamps every pre-existing row with the migration
-- time, which would make already-rendered clips look freshly re-timed (a false
-- "outdated" flag). No edits have happened at migration time, so seed each
-- row's updated_at from its own created_at. Safe as a one-time migration step.
update lyrics set updated_at = created_at;
