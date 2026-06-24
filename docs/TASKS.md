# Tasks & Sprints — Lyric Clip Generator

## Sprint 1 — DB + Core Upload Engine ✦ (demo-first, no login wall)
**Goal**: Schema live, song upload works, lyrics can be entered, demo rows visible to anyone.
- [ ] Run migration SQL (songs, lyrics, clip_segments, video_templates, exports, payments + RLS v1)
- [ ] Seed 2 demo songs with lyrics, segments, and templates
- [ ] Build `/` homepage: demo gallery of existing clips (anonymous-viewable)
- [ ] Build song upload form: title, artist, MP3/WAV file → writes `songs` row + uploads to Supabase Storage
- [ ] Build lyric entry form: paste text, split into `lyrics` rows with line_index
- [ ] Display song detail page with lyrics list
**DoD**: Upload a song, enter lyrics, see them persisted; homepage shows demo clips without login.

## Sprint 2 — AI Segment Selection ✦ v1 functional milestone
**Goal**: Core engine works end-to-end — upload → AI segments → template pick → downloadable export.
- [ ] Edge Function `score_segments`: call GPT-4o with lyrics, write 3 `clip_segments` rows with hook_score fields
- [ ] Segments list UI with hook score badges and platform labels
- [ ] Template picker: show `video_templates`, update `clip_segment.template_id`
- [ ] Remotion render job triggered server-side → writes `exports` row, stores MP4 in Storage
- [ ] Export status polling UI (queued → rendering → done)
- [ ] Download button (signed URL, 60-min expiry)
**DoD**: Full flow from uploaded song to downloaded MP4 works without payment (dev/demo mode).

## Sprint 3 — Stripe Checkout & Payment Gate
**Goal**: Real payment required before download; Stripe webhook updates export access.
- [ ] Stripe Checkout session creation API route (server-side only)
- [ ] "Export & Pay" button → redirect to Stripe hosted checkout
- [ ] Stripe webhook handler: verify signature → mark `payments.status = paid` → unlock exports
- [ ] Download button hidden until payment confirmed
- [ ] Success/cancel redirect pages
- [ ] Single-song ($4.99) and monthly subscription ($14.99) plans
**DoD**: Real Stripe test payment unlocks download; failed/cancelled payment keeps download locked.

## Sprint 4 — Whisper Auto-Transcription
**Goal**: Users can skip manual lyric entry; Whisper auto-generates timestamped lyrics.
- [ ] Edge Function `transcribe_lyrics`: upload audio → Whisper API → write `lyrics` rows with `start_ms`/`end_ms`
- [ ] "Auto-transcribe" button on song detail page
- [ ] Editable lyric table (user can correct timestamps)
- [ ] Hook scoring uses real timestamps when available
**DoD**: Upload MP3, click transcribe, get editable timestamped lyrics without typing.

## Sprint 5 — Lock It Down (Auth + Per-User RLS)
**Goal**: Users own their data; demo rows remain public; no cross-user data leaks.
- [ ] Enable Supabase Auth (email + Google OAuth)
- [ ] Sign-up / log-in pages (not the homepage)
- [ ] Replace permissive RLS policies with `auth.uid() = user_id` on all tables
- [ ] Associate new uploads/payments with `auth.uid()`
- [ ] Keep demo seed rows publicly readable (user_id = null → separate public policy)
- [ ] Protect export download routes: verify ownership before signing URL
**DoD**: Logged-in user sees only their songs/exports; anonymous visitors see only demo gallery.

---
## Gantt (sprint → feature)
```
Sprint 1  |████ DB schema + upload + lyric entry + demo gallery
Sprint 2  |████████ AI scoring + template picker + export render + download  ← v1 functional
Sprint 3  |████ Stripe checkout + payment gate
Sprint 4  |████ Whisper auto-transcription
Sprint 5  |████ Auth + RLS lock-down
```
