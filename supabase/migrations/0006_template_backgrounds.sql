-- Background visuals for templates.
-- background_style formats:
--   'solid'                      → flat primary_color (existing behavior)
--   'gradient:<hex0>:<hex1>'     → slowly-drifting two-color gradient
--     (rendered with ffmpeg's lavfi `gradients` source; previewed with CSS)
-- Caption text keeps its dark backing box in every template, so contrast
-- stays readable over any background.

alter table video_templates
  add column if not exists background_style text not null default 'solid';

insert into video_templates (id, name, preview_url, font, primary_color, animation_preset, background_style) values
  ('a1000000-0000-0000-0000-000000000004', 'Sunset Glow',   null, 'Outfit',        '#B76E79', 'fade',       'gradient:#B76E79:#D4B483'),
  ('a1000000-0000-0000-0000-000000000005', 'Lavender Haze', null, 'Outfit',        '#CBB7F5', 'bounce',     'gradient:#CBB7F5:#B76E79'),
  ('a1000000-0000-0000-0000-000000000006', 'Ocean Drift',   null, 'Inter',         '#A7C7E7', 'fade',       'gradient:#A7C7E7:#2B2B2B'),
  ('a1000000-0000-0000-0000-000000000007', 'Sage Meadow',   null, 'Inter',         '#B7C9A8', 'typewriter', 'gradient:#B7C9A8:#A7C7E7'),
  ('a1000000-0000-0000-0000-000000000008', 'Golden Hour',   null, 'Montserrat',    '#C8A24A', 'bounce',     'gradient:#C8A24A:#2B2B2B')
on conflict (id) do nothing;
