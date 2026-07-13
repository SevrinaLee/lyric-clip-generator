-- Per-clip caption style overrides (aesthetics Sprint 1): font family and
-- size, both nullable — NULL means "inherit from the template", so "reset to
-- template" is just setting the column back to NULL.
--
-- caption_font values are display names validated app-side against
-- lib/captionStyles.ts FONT_REGISTRY (premium fonts additionally gated by
-- paid access in the updateClipStyle server action). No new grants or RLS
-- needed: clip_segments already has owner-scoped policies from migration
-- 0004, and the table was never column-locked (only profiles was, in 0008).
alter table clip_segments
  add column if not exists caption_font text,
  add column if not exists caption_size text
    check (caption_size in ('sm', 'md', 'lg'));
