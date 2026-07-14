-- Scroll-stopping caption presets (aesthetics Sprint 2): per-clip position,
-- style preset, and animation overrides. All nullable — NULL inherits from
-- the template, matching 0012. Values are validated app-side against
-- lib/captionStyles.ts (outline-yellow additionally gated by paid access in
-- the updateClipStyle server action). No new grants/RLS: clip_segments is
-- already owner-scoped (0004) and was never column-locked.
alter table clip_segments
  add column if not exists caption_position text
    check (caption_position in ('center', 'lower')),
  add column if not exists caption_style_preset text
    check (caption_style_preset in ('box', 'outline', 'outline-yellow')),
  add column if not exists caption_animation text
    check (caption_animation in ('fade', 'bounce', 'wordpop'));

-- Constrain template-level animation_preset (it had no CHECK before) to the
-- known set including the new word-pop preset. All existing rows are
-- fade/bounce/typewriter, so they satisfy it; 'typewriter' stays valid and is
-- mapped to word-pop in code (resolveClipStyle), so no data migration needed.
alter table video_templates
  drop constraint if exists video_templates_animation_preset_check;
alter table video_templates
  add constraint video_templates_animation_preset_check
    check (animation_preset in ('fade', 'bounce', 'typewriter', 'wordpop'));
