# Architecture — Lyric Clip Generator

## Stack
- **Frontend**: Next.js 14 (App Router) + Tailwind + shadcn/ui — deployed on Vercel
- **Backend/DB**: Supabase (Postgres + Storage + Edge Functions)
- **AI**: OpenAI Whisper (transcription) + GPT-4o (segment ranking + hook scoring)
- **Video Rendering**: Remotion (server-side via Vercel serverless or Supabase Edge)
- **Payments**: Stripe Checkout (one-time + subscription)

## Build Sequence
**Now (v1):** Song upload → lyric entry → AI segment selection → template picker → Stripe checkout → MP4 export + download
**Next:** Auto-transcription via Whisper, richer template library, clip preview player
**Later:** Direct social publish, team workspaces, analytics on clip performance

## Key User Action — Step by Step
1. User drops MP3 → stored in Supabase Storage; `songs` row created
2. User pastes lyrics → `lyrics` rows created with line index
3. Edge Function calls GPT-4o → 3 `clip_segments` rows written with timestamps + hook_score
4. User picks template → `clip_segments.template_id` updated
5. User hits "Export & Pay" → Stripe Checkout session created (high-risk, approval-gated)
6. Stripe webhook confirms payment → `exports` job queued, Remotion renders MP4
7. Export URL stored in `exports` row → download button goes live

## Why It Works Without AI
Users can manually enter timestamps and pick segments; the clip renderer and Stripe checkout run independently of the AI scoring step. AI accelerates but does not block the pipeline.
