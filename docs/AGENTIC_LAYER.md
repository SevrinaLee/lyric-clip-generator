# Agentic Layer — Lyric Clip Generator

## Risk Levels & Actions

### Low Risk — Auto-execute
- `transcribe_lyrics(song_id)` — call Whisper, write `lyrics` rows
- `score_segments(song_id)` — call GPT-4o, write `clip_segments` with hook scores
- `tag_platform(segment_id)` — assign optimal platform based on duration + score

### Medium Risk — Show result, user confirms
- `select_template(segment_id, template_id)` — update segment, queue render preview
- `queue_export(segment_ids[])` — create `exports` rows in `queued` status

### High Risk — Always requires explicit user approval
- `create_stripe_checkout(song_id, plan)` — initiates real payment session; user must click "Pay"
- `trigger_render(export_id)` — spins up Remotion job; irreversible compute cost

### Critical — Human only, never automated
- Issue refund via Stripe
- Delete a song + all exports
- Modify payment records

## Named Tools (approved list)
- `supabase.storage.upload` — audio files only
- `openai.whisper.transcribe`
- `openai.chat.completions` (gpt-4o, segment scoring prompt only)
- `stripe.checkout.sessions.create`
- `remotion.render` (server-side, scoped)

## Audit Log Fields
`id, actor_id, action, object_type, object_id, payload_snapshot, risk_level, outcome, created_at`

## v1 Scope
Only Low + High-with-approval actions ship in v1. Medium preview confirmations land in Next sprint.
