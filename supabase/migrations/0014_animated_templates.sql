-- Animated / audio-reactive background templates (aesthetics Sprint 3).
-- background_style formats added in this phase (parsed by lib/backgrounds.ts,
-- realized by lib/render.ts):
--   'pulse:<hex0>:<hex1>'      → faster-drifting gradient that gently breathes
--   'waveform:<base>:<accent>' → the song's waveform (accent) reacting over a
--                                dark gradient derived from <base>
--
-- Value ladder: one free `pulse` template (movement for everyone); every
-- `waveform` template is premium ("audio-reactive backgrounds"). These default
-- to the scroll-stopping bold font + word-pop animation. No schema change —
-- background_style is free text and is_premium already exists (0010).

insert into video_templates
  (id, name, preview_url, font, primary_color, animation_preset, background_style, is_premium) values
  ('c1000000-0000-0000-0000-000000000001', 'Pulse Violet',  null, 'Montserrat ExtraBold', '#2a1740', 'wordpop', 'pulse:#ff6b9d:#4a2f7a',       false),
  ('c1000000-0000-0000-0000-000000000002', 'Sound Wave',    null, 'Montserrat ExtraBold', '#1a0f30', 'wordpop', 'waveform:#1a0f30:#8b7cff',    true),
  ('c1000000-0000-0000-0000-000000000003', 'Neon Wave',     null, 'Anton',                '#0a1428', 'wordpop', 'waveform:#0a1428:#00e5ff',    true),
  ('c1000000-0000-0000-0000-000000000004', 'Ember Wave',    null, 'Anton',                '#2a0f1a', 'wordpop', 'waveform:#2a0f1a:#ff9e64',    true)
on conflict (id) do nothing;
