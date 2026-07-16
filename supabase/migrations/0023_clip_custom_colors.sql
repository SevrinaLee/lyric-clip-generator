-- Per-clip custom colors (v1.7 S7.2). Turns the fixed template palette into
-- open-ended creativity: a clip can carry its own two background colors and a
-- caption color, overriding the template. All nullable = inherit from the
-- template (NULL is the pre-7.2 behavior). CHECK constraints reject anything
-- that isn't a #rrggbb hex, so a tampered write can never inject arbitrary text
-- into the render's filtergraph/ASS. RLS from 0004 already owner-scopes writes.
alter table clip_segments
  add column if not exists custom_bg_c0        text
    check (custom_bg_c0 is null        or custom_bg_c0        ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists custom_bg_c1        text
    check (custom_bg_c1 is null        or custom_bg_c1        ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists custom_caption_color text
    check (custom_caption_color is null or custom_caption_color ~ '^#[0-9a-fA-F]{6}$');
