# Product roadmap — v1.3 → v1.7 (sprint-broken spec)

> Written 2026-07-14 against v1.2 (clip aesthetics complete). Every sprint is
> independently shippable and ends with: typecheck clean, `npm run
> test:security` green (extended for any new tables/columns — CLAUDE.md
> mandate), render changes proven by frame extraction (`npm run
> verify:captions` pattern), and a production smoke check. Migrations continue
> from 0015. Free/premium calls preserve the existing ladder: free tier always
> tastes the value; premium is enforced **server-side** (never UI-only).

Grounding facts this spec relies on (verified in code):
- `lib/whisper.ts` calls OpenAI Whisper with `timestamp_granularities[]=segment`
  only; the API also supports `word`. Lyrics store line-level `start_ms/end_ms`.
- Word-pop (`lib/captionStyles.ts` `wordSchedule`) currently distributes a
  line's window **evenly** across words — the documented approximation.
- Render runs inline in `queueExport` / the download route under
  `maxDuration = 60` (Vercel serverless); ~7s for 30s @1080×1920 locally, but
  cold start + fetch + upload all share the budget.
- The design space is fixed 9:16 (`DESIGN_W/H = 1080×1920` in `lib/render.ts`);
  `exports` has a `platform` column but no dimensions.
- `payments.plan` exists (`'single' | 'subscription'`) but there is **no
  subscriptions table in migrations** (CLAUDE.md's SQL was guidance, never
  applied) and no webhook handling for recurring billing.
- `generateSegments` refuses to run twice (`"Clips already generated"`), and
  clip windows are not user-adjustable.
- `lib/access.ts` `evaluateSongAccess` → `exportTier` is the single access
  chokepoint; `profiles` is column-locked (0008).

---

## v1.3 — Caption intelligence + one-tap Looks
*Theme: make the marquee word-pop feature genuinely synced, and make great
style choices one tap instead of five.*

### Sprint 3.1 — Word-level timestamps (foundation)
**Goal:** store real per-word timing whenever Whisper transcribes, so caption
animation can sync to the vocal instead of even splits.

- `lib/whisper.ts`: request `timestamp_granularities[] = word` (keep `segment`
  too — the API allows both); parse `data.words` alongside `segments`; return
  each line with an optional `words: { text, start_ms, end_ms }[]` attached by
  assigning words to the segment window they fall inside.
- **Storage decision — new `lyric_words` table** (migration 0015), not a jsonb
  column on `lyrics`: `(id, lyric_id fk, user_id, word_index, text, start_ms,
  end_ms)`. Rationale: RLS mirrors the lyrics policies exactly (0004 pattern);
  timing-editor updates to a line can cascade-delete its words (stale words are
  worse than none); jsonb would dodge the security-suite's column-level tests.
  RLS: owner-scoped `auth.uid() = user_id`, same four policies as `lyrics`.
- `transcribeLyrics` action (`app/songs/[id]/actions.ts`): after inserting
  lyric rows, bulk-insert their words. Delete words when lyrics are replaced.
- `updateLyricTiming` / `bulkUpdateLyricTimings` / `deleteLyric`: **invalidate**
  (delete) that line's `lyric_words` — a hand-retimed line falls back to even
  split rather than keeping stale word times. Document this in the action.
- `lib/scoring.ts` `linesForSegment`: pass through each line's words (offset to
  segment-relative seconds) so render/preview can use them.
- **No UI change this sprint** — fallback behaviour identical to today.

**Free/premium:** free (it's plumbing; the payoff styles ride on it).
**Risks:** Whisper word output can drift from segment text (punctuation,
merged words) — assign words by time window, not text matching; tolerate lines
with zero words. Pasted-lyrics users (no Whisper) simply never have words.
**Verification:** unit-style script transcribing a fixture audio (or a mocked
response) asserting words land inside their line windows; security tests §8
for `lyric_words` (cross-user/anon blocked, cascade on line delete);
`npm run test:security`.
**Don't:** run Whisper twice per song (words come from the same call); build a
word-level editor UI (later, only if users ask).

### Sprint 3.2 — Synced word-pop + karaoke highlight (premium payoff)
**Goal:** word-pop lands on the actual vocal; add a `karaoke` fill style as a
premium animation.

- `lib/captionStyles.ts`: `wordSchedule(text, lineDuration, words?)` — when
  real words exist, use their offsets (clamped into the line window, monotonic);
  else the existing even split. Add `karaoke` to `CaptionAnimation`; keep the
  shared timing constants.
- `lib/render.ts`: word-pop event text consumes the schedule unchanged (it
  already takes `{word, startSec}[]`). Karaoke: one Dialogue per line using ASS
  `\k<centiseconds>` per word (duration = gap to next word) — SecondaryColour
  = dim/white, PrimaryColour = accent; set both in the style when animation is
  karaoke. `\k` only recolors — that's exactly what karaoke should do (the
  scale-pop stays word-pop's identity).
- `ClipPreviewPlayer.tsx`: pass the segment's words into the same
  `wordSchedule`; karaoke preview = per-word `color` flip at its start time
  (reuse the existing word-span rendering; no new animation machinery).
- Migration 0016: widen the two `caption_animation` / `animation_preset`
  CHECKs to include `'karaoke'`. `updateClipStyle`: validate + **gate karaoke
  as premium** (same `requirePaid` helper).
- `ClipStylePanel.tsx`: add the Karaoke chip with 🔒/★ affordance.

**Free/premium:** synced word-pop **free** (it upgrades the flagship free
look); `karaoke` **premium**.
**Risks:** sparse/missing words on some lines → schedule falls back per-line
(already handled); `\k` timing overflow on long gaps — cap each `\k` at the
line remainder.
**Verification:** extend `scripts/verify-captions.ts` with a words-provided
case; extract frames at two real word boundaries and confirm the pop/fill
lands there (not at even-split times); karaoke frames show progressive fill;
security suite (widened CHECK still rejects junk).
**Don't:** attempt beat detection; per-syllable timing.

### Sprint 3.3 — One-tap Looks
**Goal:** curated style bundles that set template + all five caption axes at
once; templates become starting points, Looks become the fast path.

- `lib/looks.ts` (new, code-defined — **no DB table**): each Look =
  `{ id, name, emoji, templateId, overrides: ClipStyleOverrides }`, e.g.
  "🔥 Viral" (Anton, lg, outline-yellow, lower, wordpop, Sound Wave bg),
  "🌊 Wave" (Montserrat ExtraBold, outline, lower, wordpop, Neon Wave),
  "🌅 Aesthetic" (Outfit, md, box, center, fade, Sunset Glow),
  "📼 Minimal" (Courier Prime, sm, box, center, fade, solid). Rationale for
  code-over-DB: Looks are curated product content that references template ids
  and registry keys — a TS module gets typechecked against both; a table can
  silently rot.
- `isLookPremium(look, templates)`: derived — premium if its template or any
  override is premium. No separate flag to drift.
- `app/songs/[id]/LooksRow.tsx` (new): a horizontal row of Look chips above
  `TemplatePicker`; tapping one calls `selectTemplate` + `updateClipStyle`
  (both existing actions — server-side gating comes free), updates local state
  via the existing `onSelect`/`onChange` callbacks. Locked Looks show 🔒 and a
  one-line upsell.
- `SegmentsPanel.tsx`: render LooksRow; highlight the active Look when the
  current template+overrides exactly match one.

**Free/premium:** at least two Looks fully free; premium Looks visible-locked
(the strongest upsell surface yet — one tap shows exactly what paying buys).
**Risks:** Look drift if a template id disappears — `lib/looks.ts` filters to
templates actually present at render time; a startup-time assert in dev.
**Verification:** dev-server: tap each Look → preview updates to the full
bundle; as free user, premium Look blocked in UI **and** the underlying
actions reject; typecheck; no new columns → no security-suite change (note it
in the PR).
**Don't:** user-saved custom Looks (that's v1.5 brand kit territory); a Looks
DB table.

---

## v1.4 — Reach: multi-format export + clip-window control
*Theme: one clip, every platform — and let users fix the machine's choices.*

### Sprint 4.1 — Aspect-ratio infrastructure
**Goal:** render any of 9:16 / 1:1 / 4:5 / 16:9 from the same clip.

- `lib/formats.ts` (new): `FORMAT_PRESETS: { "9:16": {w:1080,h:1920},
  "1:1": {1080×1080}, "4:5": {1080×1350}, "16:9": {1920×1080} }` + per-format
  caption adjustments (lower-third MarginV as a **fraction** of height, sm/md/
  lg scale factor for 16:9 where 64px is proportionally bigger).
- `lib/render.ts`: PlayResX/Y and background sizes already parameterised by
  width/height — replace the hardcoded lower-third `assMarginV: 620` with the
  fraction from `POSITION_PRESETS` × height (one change in `resolveClipStyle`
  signature: accept the format). Waveform height is already `height * 0.36`.
- `lib/exportRender.ts`: accept a format param; free tier scales each format to
  ~66% (e.g. 720×1280 stays the 9:16 free size).
- `exports`: migration 0017 adds `format text not null default '9:16'` (CHECK
  in the preset set). Download route + `exportStoragePath` include format so
  formats don't clobber each other (`{id}-{format}[-hd].mp4`).
- `queueExport(segmentId, format)`: validate format; **gate non-9:16 as
  premium** via the existing `exportTier` chokepoint.
- UI: small format picker beside Export in `SegmentsPanel` (9:16 free; others
  ★/🔒). Preview stays 9:16 this sprint — add a note under the picker
  ("preview shows 9:16; export renders {format}").

**Free/premium:** 9:16 free forever; 1:1, 4:5, 16:9 **premium** ("export every
format" headline).
**Risks:** caption legibility at 16:9 (test the `lg` size + lower third with a
long line — frame-verify); `exportsBySegment` maps latest per segment — keep
that but let the download link reflect the chosen format's latest export.
**Verification:** `verify-captions.ts` gains a format matrix (4 formats × outline/
lower) — frame-check centering and margins in each; security test that a free
user's `queueExport('1:1')` is rejected server-side.
**Don't:** per-format custom caption positions; smart-crop of backgrounds
(ours are generated, they scale natively — that's the whole advantage).

### Sprint 4.2 — Preview parity for formats + My clips awareness
**Goal:** kill the "preview shows 9:16" caveat and make the library
format-aware.

- `ClipPreviewPlayer.tsx`: aspect class derived from the selected format
  (`aspect-9/16 w-28` → mapping per format, e.g. `aspect-square`,
  `aspect-video w-40`); resolved caption style already carries position — wire
  the fraction-based margin into the preview padding.
- `/clips` page: show format chips per export; group multiple formats of the
  same segment.
- `SharePanel`: caption hashtags already platform-keyed — suggest per-format
  platforms (16:9 → YouTube).

**Free/premium:** unchanged. **Risks:** minimal, pure UI.
**Verification:** dev-server visual pass across formats + mobile viewport
(`resize_window` mobile preset); typecheck.

### Sprint 4.3 — Clip-window adjustment + re-generate
**Goal:** users can nudge what the machine chose — the top "creative control"
gap.

- `updateSegmentWindow(segmentId, start_ms, end_ms)` server action: owner-only;
  validate 3s ≤ duration ≤ 60s, within song duration; on success, the existing
  staleness signal (Refresh flow, task #19) fires naturally because the preview
  lines recompute — **no new staleness machinery**.
- `SegmentsPanel`: a compact ± nudge control (−1s/+1s on each edge) next to the
  segment header; drag can come later.
- `regenerateClips(songId)` action: replaces the "Clips already generated"
  dead-end — deletes existing segments **that have no done exports** and
  re-runs `generateSegments`; segments with exports are kept (their ids are in
  users' clips library). Confirm dialog in UI ("keeps clips you've exported").
- Migration: none (uses existing columns).

**Free/premium:** free (control of your own content is table stakes).
**Risks:** window changes invalidate `hook_score` honesty → set
`hook_score_review_status = 'user-adjusted'` on manual change (column already
exists); regeneration deleting a segment referenced by an in-flight export —
gate on export status.
**Verification:** adjust a window → preview lines shift → stale badge appears
→ Refresh produces a clip trimmed to the new window (frame-check first/last
caption); security test: B cannot call `updateSegmentWindow` on A's segment.
**Don't:** waveform-scrubber trimming UI (big); re-scoring on every nudge.

---

## v1.5 — Infrastructure + recurring revenue
*Theme: remove the 60-second ceiling, then sell the whole product monthly.*

### Sprint 5.1 — Background render pipeline (the big one)
**Goal:** renders survive cold starts, long clips, and slow formats; users see
progress instead of a spinner praying against `maxDuration`.

> **⛔ ATTEMPTED & DEFERRED (2026-07-15).** Built the `after()`-based async
> pipeline (render_jobs table + progress polling) on a `render-pipeline` branch
> and tested it on a Vercel **preview** deploy. It stalled: the export row was
> created but the `after()` callback **never executed** (export stuck
> `rendering`, no file, no job progress). Root cause: this project is on a
> Vercel plan **without Fluid Compute**, so post-response background work
> (`after()` / `waitUntil`) isn't kept alive long enough to finish a ~20–30s
> encode. Production was never touched (branch not merged) — it keeps the
> reliable **synchronous** render. Migration 0018 (`render_jobs`) is applied but
> dormant. **To ship this, one of:** (a) upgrade to Vercel Pro + enable Fluid
> Compute, then merge the `render-pipeline` branch; (b) use an external queue
> (QStash / Vercel Queue) to re-invoke a worker route; (c) Supabase Edge
> Function / cron worker. Synchronous render is fine meanwhile (clips ≤60s
> encode well inside the 60s budget), so this is a UX/scale upgrade, not a
> blocker — revisit when a heavy feature (6.3 video loops, long HD) needs it.

- **Architecture decision — DB-backed job queue, no new infra:** a
  `render_jobs` table (migration 0018: id, export_id fk, user_id, status
  `queued|running|done|failed`, progress int, attempt int, created/started/
  finished_at) + a **QStash-style self-invoking route**: `queueExport` inserts
  the job and POSTs (fire-and-forget) to `/api/render/worker` (route handler,
  `maxDuration = 300` on a paid Vercel plan — **verify plan limit first; if
  capped at 60, fall back to chunked progress-checkpointing**), authenticated
  by a shared-secret header (service-role pattern; never user session).
  Rationale: no Redis/queue vendor, RLS-visible job status, and the Stripe
  webhook already proved the server-to-server auth pattern.
- Worker: claims the job (optimistic `update ... where status='queued'`),
  renders via the existing `renderSegmentToBuffer`, uploads, updates progress
  at coarse checkpoints (fetched audio → rendered → uploaded), marks `done`.
- ffmpeg `-progress pipe:1` wiring in `lib/render.ts` for real percent (nice-
  to-have; checkpoint progress is acceptable v1).
- UI: `SegmentsPanel` polls job status (or Supabase realtime on `render_jobs`)
  → progress bar replaces "Rendering…"; the Refresh flow reuses the same path.
- The download route's lazy paid re-render also enqueues instead of inline
  when duration > ~20s.
- **Premium: priority** — paid songs' jobs claimed first (order by
  `is_priority desc, created_at`).

**Free/premium:** pipeline for everyone; **priority render** premium.
**Risks:** double-claim (solved by the optimistic update); worker route
timeout still finite — cap clip length by tier (free ≤ 30s, paid ≤ 60s,
enforced at `updateSegmentWindow`/`generateSegments`); orphaned `running` jobs
— sweep on next queue insert (retry once, then `failed`).
**Verification:** end-to-end in a Vercel **preview deploy** (the whole point
is serverless behaviour): enqueue → poll → done → download plays; kill a
worker mid-run and confirm sweep/retry; security tests §9: `render_jobs` RLS
(owner read-only, no client writes), worker route rejects requests without the
secret.
**Don't:** external queue vendors; WebSocket infra (poll/realtime is enough);
parallel multi-format fan-out (later optimisation).

### Sprint 5.2 — Subscription tier ("Creator")
**Goal:** monthly plan: every song unlocked, all premium styles/formats,
priority render.

- Stripe: create the recurring Price; `/api/stripe/checkout` already takes a
  priceId — add `mode: 'subscription'` when the price is recurring.
- Migration 0019: the `subscriptions` table **as specified in CLAUDE.md**
  (it was guidance, never applied — apply it now, RLS select-own included).
- `/api/stripe/webhooks`: handle `customer.subscription.created/updated/
  deleted` → upsert `subscriptions` via the existing service-role client
  (`lib/supabase/admin.ts`).
- `lib/access.ts`: `evaluateSongAccess` gains one early check — an `active`/
  `trialing` subscription returns `{ unlocked: true, reason: 'subscriber' }`;
  `exportTier('subscriber')` = paid tier. **Single chokepoint means every
  premium gate (fonts, styles, formats, templates, priority) lights up with
  zero further changes** — this is why the ladder was built through
  `exportTier` all along.
- UI: Pricing page adds the plan; `UNLOCK_LABEL.subscriber = "★ Creator plan"`;
  billing portal link (`/api/stripe/portal`) on the account page.

**Free/premium:** n/a — this *is* the premium consolidation. Keep single-song
purchase (it's the taste that converts).
**Risks:** webhook ordering/eventual consistency — trust
`current_period_end > now()` not just status; test clock in Stripe test mode.
**Verification:** Stripe CLI (`stripe listen --forward-to localhost:3000/api/
stripe/webhooks`, documented in CLAUDE.md) through subscribe → access flips on
a second song → cancel → access drops at period end (test clock); security
tests: subscriptions RLS select-own only; exfiltration check (no
stripe_customer_id leak — extend §4).
**Don't:** proration/seats/tiered plans; in-app cancellation UI beyond the
Stripe portal.

### Sprint 5.3 — Brand kit (premium)
**Goal:** subscribers make clips that look like *their* brand.

- Migration 0020: `brand_kits` (user_id pk/fk, display_name, accent_hex,
  watermark_text, logo_path nullable) + owner RLS; a private `brand-logos`
  storage bucket (upload via signed URL, ≤ 1MB PNG).
- `lib/render.ts`: optional brand watermark — replaces the free-tier watermark
  slot for paid renders (text via the existing Watermark ASS style with the
  user's text; logo via one extra `-i logo.png` + `overlay=W-w-40:H-h-40`).
  Accent hex becomes an optional override for `outline-yellow`'s fill and
  waveform accent.
- Account page: brand kit editor (name, color, watermark text, logo upload).
- `resolveClipStyle`/`backgroundSource`: accept optional brand accent.

**Free/premium:** premium (subscriber-oriented).
**Risks:** user-supplied hex → validate `#rrggbb` server-side (reuse HEX_RE);
logo file type sniffing (accept png/jpeg magic bytes only — the upload
handler, not the client, decides).
**Verification:** frame-check a render with brand text + logo overlay; RLS
tests §10; malicious-file test (a .html renamed .png is rejected).
**Don't:** font uploads (licensing); multi-kit management.

---

## v1.6 — Growth loops
*Theme: close the distance between "downloaded" and "posted", and let the
product market itself.*

### Sprint 6.1 — Showcase gallery (SEO + social proof)
**Goal:** a public `/showcase` of curated clips; every free clip's watermark
now points somewhere worth landing.

- Migration 0021: `showcase_entries` (id, export_id, user_id, title, approved
  boolean default false, created_at) — owner insert (opt-in "Feature this
  clip" on SharePanel), **approved rows publicly selectable** (RLS: `using
  (approved = true or auth.uid() = user_id)`); approval stays a service-role/
  SQL-editor operation for now.
- `/showcase` page (server component, public): grid of approved clips (video
  posters via a first-frame thumbnail generated at approval time), template
  name + "Made with" CTA. OG tags per entry.
- SharePanel: "✨ Submit to showcase" (explicitly consent-based — publishing a
  user's clip needs their action, so this is the opt-in).

**Free/premium:** free (it's marketing).
**Risks:** content moderation — nothing is public until approved; store only
export references (deleting the export removes the entry via FK cascade).
**Verification:** anon can read only approved rows (security test §11 — the
first deliberately-public user content, so the exfiltration suite must assert
approved-only); submit→approve→visible flow.
**Don't:** likes/comments/profiles — it's a gallery, not a social network.

### Sprint 6.2 — Direct posting (TikTok first)
**Goal:** "Download → open TikTok → upload" becomes "Post".

- **Scope decision: TikTok only** (Content Posting API), Instagram deferred
  (Graph API requires business-account linkage — poor fit for hobbyist
  musicians).
- OAuth connect flow: `/api/connect/tiktok` (authorize + callback), tokens in
  a `social_accounts` table (migration 0022, owner RLS, tokens encrypted with
  a server-side key — never selectable by clients: RLS select exposes only
  `provider, connected_at`; token columns revoked from `authenticated` like
  0008 did for profiles).
- SharePanel: "Post to TikTok" → server action pulls the export file
  server-side, calls the upload API with the generated caption, returns the
  post status/URL.
- App review: TikTok requires an approved app — **timebox the approval
  process; ship behind a feature flag** (`NEXT_PUBLIC_TIKTOK_POSTING=1`) so
  the sprint's code merges regardless.

**Free/premium:** posting free (it spreads watermarked clips — growth), but
posts of premium-styled clips obviously require the clip to exist, preserving
the ladder.
**Risks:** the app-review dependency is the schedule risk (hence flag);
token refresh handling; rate limits.
**Verification:** sandbox-mode post end-to-end; security tests: token columns
unreadable by any client role (extend §4 exfiltration), B cannot trigger posts
from A's account.
**Don't:** scheduling/queueing posts; Instagram/YouTube in the same sprint;
storing tokens client-readable "temporarily".

### Sprint 6.3 — Image/video-loop backgrounds (deferred from S3, now viable)
**Goal:** licensed motion backgrounds (rain window, vinyl spin, city bokeh) as
a premium template class — feasible now that renders are background jobs
(5.1 removed the 60s ceiling that killed this in the aesthetics phase).

- Curate 4–6 CC0/owned loops (~10s, 1080×1920, ≤ 8MB) in a public storage
  bucket or `/public/loops`; grammar extension `loop:<asset-id>` in
  `lib/backgrounds.ts`; render side: `-stream_loop -1 -i loop.mp4` as the
  background input scaled/cropped per format, filterChain trims to duration.
  Previews: a `<video muted loop>` poster in the swatch/preview (first real
  video preview — small `ClipPreviewPlayer` addition).
- Migration 0023: seed the loop templates (premium).
- License manifest checked into `assets/loops/LICENSES.md`.

**Free/premium:** premium.
**Risks:** asset size × cold fetch — cache loops in the worker's tmp between
jobs where possible; licensing hygiene (manifest + only CC0/owned).
**Verification:** frame-check loop + captions at three timestamps across a
loop boundary (no seam/flash); render-time measurement per 4.1 formats;
no new tables → no security delta beyond storage-bucket read rules.
**Don't:** user-uploaded backgrounds (moderation + licensing minefield —
revisit only with real demand).

---

## v1.6 depth pass — polish & expand within free-tier limits

Everything here is deliberately scoped to **current infra**: free Vercel (no
Fluid Compute → synchronous render inside `maxDuration`), free Supabase, and
**no OpenAI/Whisper key** (rule-based only; accurate captions come from manual
paste + the tap-timing tool). Nothing below needs a paid plan or an AI token.

### Shipped (batch 1) — variety & guardrails
- **8 new templates** (12 → 20; migration 0022, data-only via service role).
  Free solid/pulse on free fonts: Ink, Pulse Sunset, Pulse Mint, Paper.
  Premium gradient/waveform: Crimson Wave, Aurora, Mono Wave, Bubblegum.
- **3 new one-tap Looks** (→ 8 total): Bold Dark (free), Crimson + Dream
  (premium). Premium status stays derived, not flagged.
- **Tap-timing next-line preview** — shows the upcoming line so users can
  anticipate the tap (the primary accurate-caption path with no transcription).
- **Showcase abuse guard** — caps pending (unapproved) submissions per account
  to limit spam / free-tier storage pressure.

This depth pass is formalized into numbered sprints as **v1.7** below.

---

## v1.7 — Creativity, generosity & polish (the outstanding roadmap)

The remaining work, sprinted. Same constraints throughout: free Vercel
(synchronous render inside `maxDuration`, no Fluid Compute), free Supabase,
**no OpenAI/Whisper token**. Migrations continue from **0023**. Every sprint
ends at the standing verification bar and **updates the user-journey diagram**
(`docs/build-doc/generate.mjs` status maps) so the diagram is an accurate
snapshot at each shipped version.

### Sprint 7.1 — Support / Donate (fast, no moderation surface)
**Goal:** let happy users chip in without subscribing — a tip jar.
- New `/support` page: preset amounts (S$3 / S$5 / S$10) + custom amount.
- Extend the Stripe layer with a **donation** Checkout Session in `payment`
  mode, inline `price_data` (SGD), amount **validated server-side** (integer
  cents, min S$1 / max S$500 — never trust the client beyond bounds).
- Record into `payments`/`purchases` with a `donation` marker (reportable).
- **Hard rule:** a donation must NOT flip any song to `paid` or grant Creator —
  it never touches `evaluateSongAccess`. Keeps the access model honest.
- Works in both Stripe modes (standalone + platform-connect).
- **Journey:** add a **"Support / donate"** node (→ `live` when shipped).
- **No schema change**, so no new `tests/security/` section; add a unit assertion
  that the amount validator rejects out-of-range / non-integer / injected input.
**Don't:** grant anything in exchange; store card data; recurring donations.

### Sprint 7.2 — Custom colors per clip (biggest creative expand)
**Goal:** open-ended color instead of a fixed template list.
- `migration 0023_clip_custom_colors.sql`: nullable, CHECK-hex columns on
  `clip_segments` — `custom_bg_c0`, `custom_bg_c1`, `custom_caption_color`
  (`~ '^#[0-9a-fA-F]{6}$'`). NULL = inherit. RLS from 0004 already owner-scopes.
- `lib/backgrounds.ts`: `custom:<c0>:<c1>` grammar term (realized like
  `gradient`), shared preview + render.
- `updateClipStyle`: accept + validate the three hex values server-side.
- `ClipStylePanel`: color pickers (native `<input type=color>`), "Reset".
- **Free/premium:** custom colors **free** (creativity is the taste of value);
  keep premium on fonts/animations/backgrounds already gated.
- **`tests/security/` §14:** cross-user/anon write rejected; malformed/injected
  hex rejected server-side (not just UI).
**Don't:** full theming JSON; gradient angle/stops UI (two-stop only).

### Sprint 7.3 — Custom image backgrounds (Creator-gated)
**Goal:** a user's own photo behind the captions — the most-requested "make it
mine". Cheapest render of all (static composite), but the one real moderation
surface, so gated + kept out of the public showcase.
- `migration 0024_clip_bg_image.sql`: `clip_segments.custom_bg_image_path`
  (nullable text) + storage bucket `clip-backgrounds` with **owner-only RLS**
  (path prefix `<uid>/`), mirroring `brand-logos`.
- Upload server action reusing [`sniffImage`](lib/imageSniff.ts): magic-byte
  PNG/JPEG only, ≤1MB, re-encode on render **strips EXIF/GPS**.
- `lib/render.ts`: `image:<path>` background → download buffer, `scale=…:
  force_original_aspect_ratio=increase,crop` to fill the format, captions over.
- **Creator-tier gated** (`isPaidAccount`), enforced in the action + render.
- **Showcase exclusion:** clips using a custom image are **not** auto-eligible
  for the public gallery (or route through existing manual approval only).
- Storage hygiene: one active bg per user (replace-in-place), delete on clear.
- **`tests/security/` §15:** cross-user/anon upload + read rejected; non-image
  bytes rejected; unpaid account rejected server-side; path traversal rejected.
- **Journey:** the **"Template + preview"** node gains a "custom bg" capability
  note (stays `live`).
**Don't:** video-loop backgrounds (needs render headroom we don't have — stays
in S6.3 deferred); un-gated free uploads (storage + moderation blow-up).

### Sprint 7.4 — Remix from showcase + duplicate-a-clip (growth + iteration)
**Goal:** close the showcase loop and make style A/B fast.
- **Remix:** each public showcase card gets a "Remix this Look" action that
  deep-links into the create flow with the Look pre-selected (query param,
  validated against `availableLooks`). Pure growth loop, no schema.
- **Duplicate-a-clip:** copy a `clip_segments` row + its overrides for the same
  window (no re-score), so users can keep one style and vary another.
- **`tests/security/`:** duplicate action re-checks ownership (can't clone into
  someone else's song); remix param can't inject a template id.
**Don't:** cross-account remix of the actual audio (copyright); public editing.

### Sprint 7.5 — GIF export (new output surface)
**Goal:** a short looping GIF for surfaces that want it.
- Alternate output in `renderSegmentToBuffer`: `palettegen` → `paletteuse`
  two-pass, capped duration/fps to stay inside the sync budget and file size.
- Extend `exportStoragePath` + the format/plumbing; download route serves it.
- **Free/premium:** GIF free at watermarked/reduced size, HD-clean GIF paid
  (mirror the MP4 ladder).
- **Verify:** render a GIF, inspect frames + file size; measure wall-time.
**Don't:** APNG/WebP animation zoo; long GIFs (size explosion).

### Sprint 7.6 — Mobile-viewport pass + showcase pagination (polish)
**Goal:** flip the long-standing `mobile: device` journey node to `live` and
keep the gallery fast.
- Drive the app at phone widths in the in-app browser (`resize_window` mobile):
  tighten `SegmentsPanel`, `ClipStylePanel`, `TapTimingTool`, `/account`,
  `/showcase`, nav drawer — tap targets, overflow, the tap-timing controls.
- **Showcase pagination:** cursor `load-more` by `created_at`, staying inside
  ISR; keeps the public page fast as entries grow.
- **Journey:** `mobile` node **`device` → `live`** (verified on real viewport).
**Don't:** a separate mobile app; gesture rework.

### Carried-over / deferred
- **S6.2 — Direct posting (TikTok)** — *app-review process kicked off.* The
  flag-gated Login-Kit OAuth + Direct-Post integration is built and dark until
  `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET` are set (`lib/tiktok.ts`,
  `/api/tiktok/{start,callback}`; routes 404 while unconfigured). The remaining
  steps are account/consent actions only the owner can do — register the app,
  host Privacy/Terms URLs, set the env vars, record a demo, and submit for
  audit. Full checklist in [docs/tiktok-app-review.md](tiktok-app-review.md).
  Posts stay `SELF_ONLY` (private) until TikTok's audit passes; after approval,
  add a privacy-level picker.
- **S6.3 — Video-loop backgrounds** — needs the background-render headroom that
  the deferred S5.1 pipeline would provide (blocked by no Fluid Compute).

### Further ideas parked (still within constraints, not yet sprinted)
Preset "packs", per-clip emoji accent, smarter rule-based hook detection,
shareable watermarked preview link, countdown/progress-bar overlay, "apply my
brand to every clip", batch/zip export, CJK/Latin-extended caption font.

---

## Sequencing rationale & dependency graph

```
3.1 word timestamps ─→ 3.2 synced pop + karaoke
                         3.3 Looks (independent, anytime)
4.1 formats ─→ 4.2 format preview/library
4.3 window adjust (independent)
5.1 render jobs ─→ 5.3 brand kit (uses paid watermark slot)
                ─→ 6.3 video loops (needs the長 render headroom)
5.2 subscription (independent of 5.1, but priority-render perk lands with it)
6.1 showcase (independent)
6.2 TikTok posting (start app review EARLY — flag-gated code)
```

- **v1.3 first** because it compounds what just shipped: synced word-pop makes
  the new flagship feature honest, karaoke gives premium a marquee style, and
  Looks make all of v1.2 accessible in one tap. Low infra risk, high felt
  quality.
- **v1.4 before v1.5**: multi-format is the strongest *paid* feature per unit
  effort (pure plumbing over the existing design-space rescaling) and window
  adjustment answers the most likely user complaint. Both fit inline rendering
  as long as clips stay ≤ ~30s.
- **v1.5's 5.1 is the gate** for everything long/heavy (loops, long clips,
  reliable HD multi-format). 5.2 rides the `exportTier` chokepoint — one
  access check, the whole ladder lights up. Do 5.2 immediately after 5.1 so
  "priority render" launches with the plan.
- **v1.6 last**: growth loops work best when the product they spread (v1.3–
  v1.5) is at full strength. Kick off TikTok app review during v1.5 anyway —
  it's the long pole.

## Standing verification bar (every sprint)
1. `npm run typecheck` clean (ignoring the known supabase/*.ts warnings).
2. `npm run test:security` green, extended for any new table/column/endpoint
   (isolation, injection, brute-force, exfiltration — CLAUDE.md's four).
3. Render-affecting changes: `npm run verify:captions` (extended per sprint)
   + human frame inspection.
4. Migrations: numbered sequentially, applied to prod via SQL editor (DDL) or
   service role (data-only), verified by a column/row probe before deploy.
5. Deploy → `/api/health` 200 + a route smoke on production.
