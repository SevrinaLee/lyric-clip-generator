-- Which render tier the stored export file is: 'free' (watermarked, 720p) or
-- 'paid' (clean, 1080p). Written by trusted server code (queueExport and the
-- download route's paid re-render); users never set it directly.
alter table exports
  add column if not exists tier text not null default 'free';
