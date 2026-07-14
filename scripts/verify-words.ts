// Unit checks for v1.3 S3.1 word-timing plumbing:
//  - attachWords assigns words to the right line by time (tolerating drift/gaps)
//  - linesForSegment passes word timing through with segment-relative offsets
// Run: npm run verify:words  (tsx scripts/verify-words.ts)
import assert from "node:assert/strict";
import { attachWords } from "../lib/whisper";
import { linesForSegment } from "../lib/scoring";
import type { Lyric } from "../lib/types";

let passed = 0;
const ok = (name: string) => {
  passed++;
  console.log("  ✓", name);
};

// ── attachWords ────────────────────────────────────────────────────────────
// Segments 0-2s / 2-4s / 4-6s; a word before the first segment, one in a gap.
const segments = [
  { text: "hello world", start: 0, end: 2 },
  { text: "", start: 2, end: 4 }, // empty → dropped, its words reassigned
  { text: "final line here", start: 4, end: 6 },
];
const words = [
  { word: " lead", start: -0.2, end: 0.0 }, // before first → line 0
  { word: "hello", start: 0.1, end: 0.5 },
  { word: "world", start: 0.6, end: 1.2 },
  { word: "gap", start: 2.5, end: 2.9 }, // inside the dropped empty segment window
  { word: "final", start: 4.1, end: 4.4 },
  { word: "line", start: 4.5, end: 4.8 },
  { word: "here", start: 4.9, end: 5.4 },
  { word: "   ", start: 5.5, end: 5.6 }, // blank → skipped
];

const lines = attachWords(segments, words);
assert.equal(lines.length, 2, "empty segment dropped");
// 'gap' fell in the dropped empty segment; it attaches to the last KEPT
// segment whose start <= its start (line 0) rather than being dropped —
// the intended "never lose a word" behaviour for drift/gaps.
assert.deepEqual(lines[0].words?.map((w) => w.text), ["lead", "hello", "world", "gap"], "line 0 words");
ok("attachWords: leading + gap words attach to line 0 (none dropped)");
assert.equal(lines[0].start_ms, 0);
assert.equal(lines[0].end_ms, 2000);
ok("attachWords: line timings in ms");
assert.deepEqual(lines[1].words?.map((w) => w.text), ["final", "line", "here"], "line 2 words (blank skipped)");
ok("attachWords: blank word skipped, others assigned");
assert.equal(lines[1].words?.[0].start_ms, 4100);
ok("attachWords: word start in ms");

// no words at all → words undefined, lines still returned
const noWords = attachWords(segments, []);
assert.equal(noWords[0].words, undefined, "no words → undefined");
ok("attachWords: tolerates zero words");

// ── linesForSegment pass-through ─────────────────────────────────────────────
const lyrics: Lyric[] = [
  { id: "a", user_id: null, song_id: "s", line_index: 0, text: "hello world", start_ms: 10000, end_ms: 12000, created_at: "",
    words: [ { text: "hello", start_ms: 10000, end_ms: 10500 }, { text: "world", start_ms: 11000, end_ms: 11800 } ] },
  { id: "b", user_id: null, song_id: "s", line_index: 1, text: "outside", start_ms: 40000, end_ms: 42000, created_at: "" },
];
const seg = { start_ms: 9000, end_ms: 20000, label: "Hook" };
const pl = linesForSegment(lyrics, 200, seg);
assert.equal(pl.length, 1, "only the in-window line");
assert.equal(pl[0].text, "hello world");
// line offset = (10000 - 9000)/1000 = 1s; word offsets 1s and 2s
assert.equal(pl[0].offsetSeconds, 1);
assert.equal(pl[0].words?.length, 2);
assert.equal(pl[0].words?.[0].offsetSeconds, 1);
assert.equal(pl[0].words?.[1].offsetSeconds, 2);
ok("linesForSegment: word timing passes through with segment-relative offsets");

// a line without words → words undefined (fallback path unchanged)
const lyricsNoWords: Lyric[] = [
  { id: "c", user_id: null, song_id: "s", line_index: 0, text: "no timing", start_ms: null, end_ms: null, created_at: "" },
];
const pl2 = linesForSegment(lyricsNoWords, 200, { start_ms: 0, end_ms: 200000, label: "Hook" });
assert.equal(pl2[0].words, undefined, "no words → undefined (even-split fallback)");
ok("linesForSegment: absent words leaves behaviour unchanged");

console.log(`\n${passed} checks passed`);
