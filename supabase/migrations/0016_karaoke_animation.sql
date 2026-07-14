-- Karaoke caption animation (aesthetics v1.3 Sprint 3.2). Widens the two
-- animation CHECK constraints to allow 'karaoke'. Existing values all remain
-- valid, so no data migration. karaoke is premium-gated in updateClipStyle.
alter table clip_segments
  drop constraint if exists clip_segments_caption_animation_check;
alter table clip_segments
  add constraint clip_segments_caption_animation_check
    check (caption_animation in ('fade', 'bounce', 'wordpop', 'karaoke'));

alter table video_templates
  drop constraint if exists video_templates_animation_preset_check;
alter table video_templates
  add constraint video_templates_animation_preset_check
    check (animation_preset in ('fade', 'bounce', 'typewriter', 'wordpop', 'karaoke'));
