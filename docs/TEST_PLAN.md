# Test Plan — Lyric Clip Generator

## v1 Success Scenario (manual)
1. Open `/` — see demo gallery with 2 songs and clip thumbnails. No login prompt.
2. Click "New Song" → fill title "Neon City", artist "Demo Artist", upload `neon_city.mp3` → submit.
3. Confirm `songs` row appears in Supabase Table Editor with status `uploaded`.
4. On song detail page, paste 8 lines of lyrics → submit.
5. Confirm 8 `lyrics` rows in DB with correct `line_index`.
6. Click "Generate Clips" → spinner shows → 3 clip segments appear with hook scores (0–1) and platform badges.
7. Confirm 3 `clip_segments` rows in DB with `hook_score_source = 'gpt-4o'` and `review_status = 'unreviewed'`.
8. Pick template "Typewriter Dark" for segment 1 → confirm `template_id` updated in DB.
9. Click "Export & Pay" → redirected to Stripe Checkout (test mode).
10. Complete payment with Stripe test card `4242 4242 4242 4242`.
11. Redirected to success page → export status shows `rendering` then `done`.
12. Confirm `payments.status = paid` and `exports.video_url` populated in DB.
13. Click Download → MP4 file downloads; URL is a signed Storage URL (expires in 60 min).

## Empty State Cases
- Song with no lyrics → "Add lyrics to continue" prompt; Generate Clips button disabled.
- Segment generation fails → toast error "Couldn't score clips — please try again"; no partial rows written.
- No templates seeded → template picker shows "No templates available" fallback.

## Error Cases
- Upload file > 50 MB → client-side validation error before any network call.
- Stripe payment cancelled → redirect to cancel page; export remains locked; retry button shown.
- Stripe webhook with invalid signature → 400 returned; no DB change; logged to `audit_logs`.
- Signed URL accessed after 60 min → 403 from Supabase Storage; user shown "Link expired — re-download from your dashboard".

## Edge Cases
- Uploading same song twice → new `songs` row created (duplicates allowed in v1).
- Lyrics with blank lines → blank lines skipped; `line_index` is contiguous.
- Hook score tie (two segments score equally) → both shown; platform label differentiates them.
