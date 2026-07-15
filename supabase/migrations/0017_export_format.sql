-- Export aspect ratio (aesthetics v1.4 Sprint 4.1). Defaults to 9:16 so all
-- existing exports keep their meaning. CHECK constrains to the known set;
-- non-9:16 formats are premium, gated in the queueExport server action (the
-- exportTier chokepoint), not by RLS. No new grants: exports is already
-- owner-scoped and users set this via queueExport on their own rows.
alter table exports
  add column if not exists format text not null default '9:16'
    check (format in ('9:16', '1:1', '4:5', '16:9'));
