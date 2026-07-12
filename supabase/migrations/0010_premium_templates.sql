-- Premium templates: a paid perk. The gradient-background templates become
-- premium; the three solid templates stay free so free users still have
-- variety. Enforced server-side (selectTemplate + generateClips defaults).
alter table video_templates
  add column if not exists is_premium boolean not null default false;

update video_templates
  set is_premium = true
  where background_style like 'gradient:%';
