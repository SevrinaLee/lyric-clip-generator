# Intelligence Layer — Lyric Clip Generator

## Messy Input
- Raw lyric text (no timestamps, inconsistent line breaks)
- Audio file (no beat markers)
- Vague user preference: "make it viral"

## Auto-Structure Schema (GPT-4o prompt output)
```json
{
  "segments": [
    {
      "label": "Hook",
      "start_ms": 42000,
      "end_ms": 68000,
      "platform": "tiktok",
      "hook_score": 0.91,
      "reason": "High-energy chorus with repeating title phrase"
    }
  ]
}
```

## Events to Track
- Song uploaded
- Lyrics submitted
- Segments generated (AI)
- Template selected
- Checkout initiated
- Payment confirmed
- Export downloaded

## Scoring Rules (v1 — rule-based, no ML)
| Signal | Weight |
|---|---|
| Line repetition in segment | +0.2 |
| Segment contains song title | +0.2 |
| Duration 15–30 s | +0.2 |
| Exclamation / question marks | +0.1 |
| Starts on a strong beat (ms divisible by ~500) | +0.15 |
| Ends cleanly (silence gap) | +0.15 |

Scores stored as `hook_score` + `hook_score_confidence` + `hook_score_source` + `hook_score_review_status`.

## v1 vs Later
- **v1**: Rule-based hook scoring; GPT-4o selects segments from lyric text alone
- **Next**: Whisper timestamps align lyrics to audio automatically
- **Later**: Fine-tuned model trained on clip engagement data; per-platform score optimization
