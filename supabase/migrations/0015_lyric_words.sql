-- Per-word timing (aesthetics v1.3 Sprint 3.1). Whisper can return word-level
-- timestamps; storing them lets caption animation sync to the actual vocal
-- instead of an even split across a line's window.
--
-- Discrete table (not a jsonb column on lyrics) so RLS mirrors the lyrics
-- policies exactly and the security suite can assert column-level behaviour.
-- FK is ON DELETE CASCADE: deleting a lyric line removes its words, and
-- replacing a song's lyrics (transcribe/paste) cleans up old words for free.
-- Timing EDITS to a line still delete its words explicitly in the server
-- actions (cascade only fires on delete), so a hand-retimed line falls back to
-- the even split rather than keeping stale word times.
create table if not exists lyric_words (
  id uuid primary key default gen_random_uuid(),
  lyric_id uuid not null references lyrics(id) on delete cascade,
  user_id uuid references auth.users,
  word_index int not null,
  text text not null,
  start_ms int not null,
  end_ms int not null,
  created_at timestamptz not null default now()
);

create index if not exists lyric_words_lyric_id_idx on lyric_words(lyric_id);

alter table lyric_words enable row level security;

-- Owner-scoped, same shape as the lyrics policies (migration 0004). Null
-- user_id rows are readable (parity with lyrics' public/demo rows).
drop policy if exists "lyric_words_read" on lyric_words;
create policy "lyric_words_read" on lyric_words
  for select using (user_id is null or auth.uid() = user_id);
-- Insert must own BOTH the word row (user_id) AND the parent lyric — otherwise
-- another user could attach words to your lyric (owned by them). The lyric
-- ownership check is what the security suite § 8 verifies.
drop policy if exists "lyric_words_insert" on lyric_words;
create policy "lyric_words_insert" on lyric_words
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from lyrics
      where lyrics.id = lyric_id and lyrics.user_id = auth.uid()
    )
  );
drop policy if exists "lyric_words_update" on lyric_words;
create policy "lyric_words_update" on lyric_words
  for update using (auth.uid() = user_id);
drop policy if exists "lyric_words_delete" on lyric_words;
create policy "lyric_words_delete" on lyric_words
  for delete using (auth.uid() = user_id);
