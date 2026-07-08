# Product Requirements — Lyric Clip Generator

## Problem
Musicians and music marketers waste hours manually cutting songs and animating lyrics for TikTok, Reels, and Shorts. There is no fast, cheap tool that goes from audio file → 3 platform-ready lyric clips in minutes.

## Target Users
Musicians, music marketers, social media managers, independent content creators.

## Core Objects
- **Song** — uploaded audio + metadata
- **Lyrics** — full lyric text, timestamped lines
- **Clip Segment** — start/end timestamps, hook score, platform target
- **Video Template** — visual style, font, color scheme, animation preset
- **Export** — rendered video file, platform, status, download URL
- **Subscription / Payment** — plan, Stripe checkout session, access status

## MVP Must-Haves
- [ ] Upload an audio file (MP3/WAV) and enter song title + artist
- [ ] Paste or auto-transcribe lyrics, get timestamped lines
- [ ] AI selects 3 best clip segments (8–30 s each) with hook scores
- [ ] User previews each segment and picks a video template
- [ ] Exports render and are downloadable (MP4)
- [ ] Stripe checkout gates download (one-time pay-per-song or subscription)
- [ ] Demo gallery visible to anonymous visitors

## Non-Goals (v1)
- Direct publish to TikTok/Instagram/YouTube APIs
- Team collaboration / multi-seat accounts
- Custom font uploads
- Mobile app
- Beat detection / music analysis beyond hook scoring

## Success Scenario
A musician uploads "Neon City.mp3", pastes 24 lines of lyrics, receives 3 ranked clip suggestions with animated previews, pays $4.99 via Stripe, and downloads three MP4 files within 5 minutes.
