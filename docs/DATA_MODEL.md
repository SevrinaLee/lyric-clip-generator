# Data Model — Lyric Clip Generator

## songs
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid nullable | owner, set at lock-down |
| title | text | |
| artist | text | |
| audio_url | text | Supabase Storage path |
| duration_seconds | numeric | |
| status | text | `uploaded` `processing` `ready` |
| created_at | timestamptz | |

## lyrics
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid nullable | |
| song_id | uuid FK → songs | |
| line_index | integer | |
| text | text | |
| start_ms | integer | milliseconds |
| end_ms | integer | |
| created_at | timestamptz | |

## clip_segments
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid nullable | |
| song_id | uuid FK → songs | |
| label | text | e.g. "Hook", "Chorus" |
| start_ms | integer | |
| end_ms | integer | |
| platform | text | `tiktok` `reels` `shorts` |
| template_id | uuid FK → video_templates | |
| hook_score | numeric | **AI field** |
| hook_score_source | text | `gpt-4o` |
| hook_score_confidence | numeric | 0–1 |
| hook_score_review_status | text | default `unreviewed` |
| created_at | timestamptz | |

## video_templates
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| preview_url | text | |
| font | text | |
| primary_color | text | hex |
| animation_preset | text | `fade` `bounce` `typewriter` |
| created_at | timestamptz | |

## exports
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid nullable | |
| clip_segment_id | uuid FK → clip_segments | |
| status | text | `queued` `rendering` `done` `failed` |
| platform | text | |
| video_url | text | nullable until done |
| payment_id | uuid FK → payments | |
| created_at | timestamptz | |

## payments
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid nullable | |
| song_id | uuid FK → songs | |
| stripe_session_id | text | |
| stripe_payment_intent | text | |
| amount_cents | integer | |
| status | text | `pending` `paid` `failed` |
| plan | text | `single` `subscription` |
| created_at | timestamptz | |

## RLS
All tables have RLS enabled. v1: permissive read + write for demo. Lock-down sprint replaces with `auth.uid() = user_id`.
