-- More template variety (v1.6 depth pass). Data-only, applied via the
-- service role (like 0014); no schema change. Free templates use solid/pulse
-- backgrounds and FREE fonts (a template's default font isn't gated, so a free
-- template must not default to a premium font); premium templates use
-- gradient/waveform backgrounds and may default to premium display fonts.
insert into video_templates
  (id, name, preview_url, font, primary_color, animation_preset, background_style, is_premium) values
  -- Free
  ('d1000000-0000-0000-0000-000000000001', 'Ink',          null, 'Montserrat ExtraBold', '#12121a', 'wordpop', 'solid',                    false),
  ('d1000000-0000-0000-0000-000000000002', 'Pulse Sunset', null, 'Montserrat ExtraBold', '#ff6b35', 'wordpop', 'pulse:#ff6b35:#ffd166',    false),
  ('d1000000-0000-0000-0000-000000000003', 'Pulse Mint',   null, 'Outfit',               '#0b3d3b', 'wordpop', 'pulse:#0b3d3b:#2ec4b6',    false),
  ('d1000000-0000-0000-0000-000000000004', 'Paper',        null, 'Courier Prime',        '#f2ede3', 'fade',    'solid',                    false),
  -- Premium
  ('d1000000-0000-0000-0000-000000000005', 'Crimson Wave', null, 'Anton',                '#1a0510', 'wordpop', 'waveform:#1a0510:#ff2d55', true),
  ('d1000000-0000-0000-0000-000000000006', 'Aurora',       null, 'Poppins Bold',         '#3a1c71', 'bounce',  'gradient:#3a1c71:#d76d77', true),
  ('d1000000-0000-0000-0000-000000000007', 'Mono Wave',    null, 'Anton',                '#101010', 'wordpop', 'waveform:#101010:#ffffff', true),
  ('d1000000-0000-0000-0000-000000000008', 'Bubblegum',    null, 'Poppins Bold',         '#ff9a9e', 'wordpop', 'gradient:#ff9a9e:#a18cd1', true)
on conflict (id) do nothing;
