// Single-source generator for the Lyric Clip Generator build documentation.
// Edit META, BLOCKS, and MILESTONES below, then run `node generate.mjs`.
// It writes BOTH build-documentation.pdf and BUILD_DOCUMENTATION.md so the
// two never drift apart. Outputs go to the parent folder (the repo docs/).
//
//   cd docs/build-doc && npm install && node generate.mjs
//
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { createWriteStream, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PDF_PATH = resolve(OUT, "build-documentation.pdf");
const MD_PATH = resolve(OUT, "BUILD_DOCUMENTATION.md");

// ============================================================ CONTENT MODEL
const META = {
  title: "Lyric Clip Generator",
  subtitle: "How this app was built",
  tagline:
    "A build-and-decisions log of the work that took this app from an empty repo to a live, paying product — written for the whole team.",
  version: "Version 1.5 — intelligence, reach & recurring revenue",
  versionShort: "v1.5",
  repo: "github.com/SevrinaLee/lyric-clip-generator",
  live: "lyric-clip-generator.vercel.app",
  date: "12 July 2026",
  author: "Built by SevrinaLee with Claude Code (pair-built).",
};

// Journey nodes (shared by the PDF diagram and the Markdown status tables).
const SPINE = [
  { k: "discover", lines: ["Discover", "landing/pricing/FAQ"], name: "Discover (landing / pricing / FAQ)" },
  { k: "auth", lines: ["Sign up /", "log in"], name: "Sign up / log in" },
  { k: "mysongs", lines: ["My songs"], name: "My songs" },
  { k: "upload", lines: ["Upload song"], name: "Upload song" },
  { k: "lyrics", lines: ["Add lyrics"], name: "Add lyrics" },
  { k: "timing", lines: ["Edit timing"], name: "Edit timing" },
  { k: "generate", lines: ["Generate clips"], name: "Generate clips" },
  { k: "template", lines: ["Template +", "preview"], name: "Template + preview" },
  { k: "export", lines: ["Export MP4"], name: "Export MP4" },
  { k: "access", lines: ["Access check"], name: "Access check (founder / free / paid)" },
  { k: "pay", lines: ["Pay to unlock"], name: "Pay to unlock (card / PayNow / GrabPay)" },
  { k: "download", lines: ["Download MP4"], name: "Download MP4" },
  { k: "share", lines: ["Share +", "caption"], name: "Share + caption" },
  { k: "account", lines: ["Account"], name: "Account" },
  { k: "myclips", lines: ["My clips"], name: "My clips (library)" },
];
const FOUND = [
  { k: "navshell", lines: ["Nav shell"], name: "Nav shell" },
  { k: "mobile", lines: ["Mobile layout"], name: "Mobile layout" },
  { k: "security", lines: ["Security + RLS"], name: "Security + RLS" },
  { k: "payinfra", lines: ["Payments infra"], name: "Payments infra" },
];

const base = () => Object.fromEntries([...SPINE, ...FOUND].map((n) => [n.k, "todo"]));
const M1 = { ...base(), discover: "live", auth: "live", upload: "live", lyrics: "live", timing: "live", generate: "live", template: "live", export: "config", pay: "config", download: "live", security: "config", payinfra: "config" };
const M2 = { ...M1, export: "live" };
const M3 = { ...M2, account: "live" };
const M4 = { ...M3, access: "live", security: "live" };
const M5 = { ...M4, mysongs: "live", navshell: "live", mobile: "device" };
const M6 = { ...M5, pay: "live", payinfra: "live" };
const M7 = { ...M6, share: "live", myclips: "live" };

// helpers to build the block list
const h1 = (text) => ({ type: "h1", text });
const h2 = (text) => ({ type: "h2", text });
const para = (text, o = {}) => ({ type: "para", text, ...o });
const bullets = (items) => ({ type: "bullets", items });
const callout = (title, lines) => ({ type: "callout", title, lines });
const journey = (statusMap, caption) => ({ type: "journey", statusMap, caption });

const commits = [
  ["2026-06-24", "Initialise project, plan pack (PRD, architecture, sprints), initial schema migration"],
  ["2026-07-08", "Restore plan pack + migrations, add storage-buckets migration"],
  ["2026-07-09", "Sprint 1 - demo gallery, song upload, lyric entry"],
  ["2026-07-09", "Sprint 2 - hook scoring, template picker, real MP4 export"],
  ["2026-07-09", "Sprint 3 - Stripe checkout payment gate"],
  ["2026-07-09", "Sprint 4 - Whisper auto-transcription"],
  ["2026-07-09", "Sprint 5 - auth + per-user RLS lock-down"],
  ["2026-07-09", "Fix auth production bugs (site URL, rate limit, hide unconfigured Google button)"],
  ["2026-07-09", "Hide export/edit controls on songs the viewer does not own"],
  ["2026-07-09", "Brand redesign across all pages"],
  ["2026-07-09", "Editable lyrics without timestamps, live template preview, synced clip preview"],
  ["2026-07-09", "Delete lyric lines, correctable timing for all songs"],
  ["2026-07-09", "Tap-to-time lyrics, broader hero copy, account/billing nav"],
  ["2026-07-09", "Fix export crash in production (ERR_INVALID_ARG_TYPE - font path)"],
  ["2026-07-09", "Fix export crash (ffmpeg ENOENT - binary missing from bundle)"],
  ["2026-07-09", "Fix export failing ('Filter not found' - switch to ass subtitles)"],
  ["2026-07-09", "Forgot password, FAQ + pricing pages, gradient background templates"],
  ["2026-07-09", "Multi-method Stripe checkout (SGD/PayNow-ready) + profile display name"],
  ["2026-07-10", "Add DevSecOps security suite (tests/security/)"],
  ["2026-07-11", "Sanitise env secrets (BOM/whitespace) + preflight in security tests"],
  ["2026-07-11", "Founder comp access + one free song per user"],
  ["2026-07-11", "Responsive nav shell + My songs page (Phase 1)"],
  ["2026-07-11", "Mobile optimisation pass (Phase 2)"],
  ["2026-07-12", "Connect and verify live Stripe payments (v1.0)"],
  ["2026-07-12", "Build documentation (PDF + Markdown) from a single-source generator"],
  ["2026-07-12", "My clips history page (retention)"],
  ["2026-07-12", "Share + caption helpers (distribution)"],
  ["2026-07-12", "Watermark + resolution value ladder (monetization)"],
  ["2026-07-12", "Premium templates gated to paid access"],
  ["2026-07-13", "Font fidelity + per-clip font/size customization (aesthetics S1)"],
  ["2026-07-13", "Scroll-stopping caption presets: outline, lower-third, word-pop (S2)"],
  ["2026-07-13", "Animated + audio-reactive waveform backgrounds (S3)"],
  ["2026-07-13", "Consolidated per-clip Customize panel (S4)"],
  ["2026-07-13", "Per-clip Refresh + stale-clip 'outdated' signal"],
  ["2026-07-14", "Clarify first-song-free pricing + prompt caption timing sync (fixes)"],
  ["2026-07-14", "Word-level timestamp foundation (v1.3 S3.1)"],
  ["2026-07-14", "Synced word-pop + premium karaoke captions (S3.2)"],
  ["2026-07-14", "One-tap Looks - curated style bundles (S3.3)"],
  ["2026-07-15", "Multi-format export: 1:1 / 4:5 / 16:9 (v1.4 S4.1)"],
  ["2026-07-15", "Format-aware preview + library, clip-window nudge & regenerate (S4.2/4.3)"],
  ["2026-07-15", "Creator subscription tier (v1.5 S5.2)"],
  ["2026-07-15", "Brand kit: custom watermark, logo, accent (v1.5 S5.3)"],
];

const BLOCKS = [
  h1("1.  What this app is"),
  para("Lyric Clip Generator turns a piece of audio into short, vertical, platform-ready lyric video clips. A user uploads a song (or cover, poem, or podcast), adds the lyrics, and the app finds the most hook-worthy moments, scores them, lets the user pick a visual template and preview it, then renders a finished MP4 with burned-in captions ready to post to TikTok, Reels, or Shorts."),
  para("It is a full product, not a prototype: real accounts, real per-user data isolation, real video rendering, and real payments (card, PayNow, GrabPay) in Singapore dollars."),
  h2("The one-line pitch"),
  callout(null, ["Audio in - three scroll-stopping, hook-scored lyric clips out, in minutes, with no editing skills required."]),
  h2("How to read this document"),
  para("Section 2 tells the story in the order it happened, grouped into the phases we actually worked in, with the reasoning behind the important decisions. At the end of each phase you will see the user-journey status as it stood at that moment, so you can watch the app grow. Section 3 is the current status. Appendix A is a plain chronological list of every commit. Appendix B is a technical reference for engineers."),
  para("Throughout, each step of the journey is status-coded:"),
  bullets([
    "Live - built, deployed, and working in production.",
    "Built, needs config - the code is done, but a key or setting is required before it fully works.",
    "Verify on device - built, but not yet visually confirmed at that screen size.",
    "Not built yet - does not exist at this stage.",
  ]),

  h1("2.  The build story, phase by phase"),

  h2("Phase 1 - The core engine (Sprints 1-5)"),
  para("The first push built the entire spine of the product from an empty repository, following a plan pack (PRD, architecture, sprint breakdown) that shipped with the template. Five sprints landed back to back:"),
  bullets([
    "Sprint 1 - database, song upload, and lyric entry. Audio is stored in Supabase Storage; songs and lyrics live in Postgres.",
    "Sprint 2 - the heart of the product: rule-based hook scoring (which picks the catchiest moments without needing an AI key), a template picker, and real MP4 export via ffmpeg.",
    "Sprint 3 - a Stripe checkout payment gate so exports could be monetised.",
    "Sprint 4 - optional auto-transcription via OpenAI Whisper, for users who do not want to type lyrics.",
    "Sprint 5 - accounts and a per-user security lock-down using Postgres Row-Level Security (RLS), so one user can never see another's data.",
  ]),
  callout("Key decision - why rule-based scoring, not AI", ["The 'intelligence' that picks hook moments is deliberately rule-based, so the core product works with zero AI API keys and zero per-use cost. AI transcription is an optional add-on, never a dependency. This keeps the app cheap to run and resilient."]),
  callout("Key decision - security is enforced by the database, not the app", ["Data isolation is enforced by Postgres Row-Level Security, so even a bug in application code cannot leak one user's songs or payments to another. The powerful service-role key is only ever used server-to-server, never in the browser."]),
  journey(M1, "Journey after Phase 1: the whole create-to-download loop exists. Export is amber because it worked locally but had not yet survived the production environment. Payments are a scaffold with no live key."),

  h2("Phase 2 - Making it actually work in production, plus a UX pass"),
  para("A working demo on a laptop is not a working product. Several things that passed locally broke on the live Vercel/serverless environment, and fixing them was a real chunk of the work — the kind of thing worth documenting because it will recur on any similar project."),
  bullets([
    "The MP4 export crashed three separate times in production for three different reasons, each invisible on the local machine.",
    "The template picker, lyric editing, and clip preview were rebuilt to be genuinely usable: edit lyrics with or without timestamps, a live template preview, and a tap-to-time tool that lets you tap along to the song instead of typing timecodes.",
    "A full brand redesign gave every page a consistent, considered look.",
  ]),
  callout("The production export saga (a cautionary tale)", [
    "1. The font file path resolved to a numeric module id inside the production bundle, not a real path - crash. Fixed by shipping the font with the app.",
    "2. The ffmpeg binary was missing from the serverless bundle, and a stale build cache hid it - crash. Fixed by forcing the binary into the bundle.",
    "3. The production ffmpeg build simply did not include the 'drawtext' feature we relied on - crash. Fixed by switching caption rendering to the 'ass' subtitle method the binary did support.",
    "Lesson: 'works on my machine' is not 'works in production' - each was only found by reading real production logs.",
  ]),
  journey(M2, "Journey after Phase 2: export is now genuinely live in production. The account area does not exist yet."),

  h2("Phase 3 - Growth features"),
  para("With the core solid, the next phase added the things a real product needs around the edges: a forgot-password flow, dedicated Pricing and FAQ pages, more visual templates (including animated gradient backgrounds while keeping captions readable), an account page where users can set a display name and manage billing, and the payments code upgraded to offer multiple methods (card, PayNow QR, GrabPay) in Singapore dollars."),
  callout("Key decision - payments built mode-agnostic", ["Checkout does not hard-code which payment methods to show. It lets the Stripe dashboard decide, so enabling PayNow or GrabPay is a settings change, not a code change. The currency was set to SGD because PayNow and GrabPay require it."]),
  journey(M3, "Journey after Phase 3: the account area is live. Payments remain amber - the code is complete, but no live Stripe key was connected yet."),

  h2("Phase 4 - Security you can prove, and a smarter access model"),
  para("The project's own rules require that any change touching data or auth be backed by automated security tests. This phase delivered that: an executable DevSecOps test suite covering the four things that matter, wired to run automatically on every code change."),
  bullets([
    "Data isolation - proves one user cannot read or modify another's songs, payments, or profile.",
    "SQL-injection - fires real attack strings at every input and proves they are treated as harmless text.",
    "Brute-force - proves rapid failed logins get rate-limited.",
    "Data-exfiltration - proves list views never leak other users' rows or sensitive fields.",
  ]),
  para("It also introduced a smarter download-access model: founder/QA accounts that get everything free, and one free song for every new user (their first download), with everything after that paid. Both are enforced server-side and locked so a user cannot promote themselves."),
  callout("Key decision - founder access and the free song are locked at the database level", ["The 'is this account a founder' and 'which song is free' flags can only be written by trusted server code. The database revokes a normal user's ability to change them, so no one can grant themselves free access. A security test guards this forever."]),
  journey(M4, "Journey after Phase 4: the access check is live (founder / first-song-free / paid), and security is verified by an automated suite running in CI."),

  h2("Phase 5 - Navigation shell and mobile"),
  para("Until now the app had a single top bar. This phase turned it into a proper responsive shell: a left sidebar on desktop that collapses into a hamburger-drawer menu on phones, shown only to signed-in users so the landing page stays welcoming. A new 'My songs' page gave signed-in users a home base listing their own uploads. A follow-up pass tightened spacing, tap targets, and the lyrics editor for small screens."),
  journey(M5, "Journey after Phase 5: My songs and the navigation shell are live. Mobile layout is blue - built and code-verified, but the phone-width view had not been driven on a real device in the build environment."),

  h2("Phase 6 - Payments go live"),
  para("The final step to a true 1.0: connecting a live Singapore Stripe account. The secret key and webhook were configured, and the whole payment path was verified end to end without spending real money — the live key was confirmed valid and in live mode, a real checkout session was created and shown to offer card, GrabPay, PayNow and Link, and the webhook was proven to accept correctly-signed events and reject forged ones."),
  journey(M6, "Journey at v1.0: every step of the core loop is live, including real multi-method payments. Only the on-device mobile spot-check remains as blue."),

  h2("Phase 7 - Expanding the journey (post-1.0)"),
  para("With a shippable 1.0 live, the next phase reshaped the journey from a one-and-done download into a loop, and sharpened the reasons to pay. Three additions, chosen from a brainstorm over the journey diagram itself:"),
  bullets([
    "Retention - a 'My clips' library listing every finished export across songs, so the app becomes somewhere users return to, not a single-use tool.",
    "Distribution - a share panel offering a ready-to-post caption and platform hashtags (rule-based, no AI key), with copy and native share, carrying users past download toward actually posting.",
    "Monetization - a value ladder: free exports are watermarked and 720p; paying removes the watermark, renders at full 1080p, and unlocks the premium (gradient) templates.",
  ]),
  callout("Key decision - the watermark is also the growth engine", ["Every free clip carries a small 'made with Lyric Clip Generator' mark, so shared free clips advertise the app. Because rendering happens before payment, the download route lazily re-renders a clean HD version on the first paid download - so paying genuinely removes the mark."]),
  para("A later refinement closed a trust gap in this loop. A rendered clip is a baked file, so editing lyric timing afterwards left the download silently out of date. Each clip zone now shows a Refresh control that re-renders from the latest saved timing, and when timing changes after a render the zone auto-flags itself 'outdated' (comparing the song's most recent lyric edit to when the clip was rendered) while reassuring the user that the live preview is already current. The result is an explicit guarantee that the downloadable clip can always be brought in line with the latest timing."),
  journey(M7, "Journey after Phase 7: Share + caption and the My clips library are live, and the pay step now drives a watermark / resolution / premium-template value ladder."),

  h2("Phase 8 - Making clips scroll-stopping (v1.2)"),
  para("With the loop complete, the clips themselves still looked plain, so a four-sprint push made them customizable and eye-catching. Sprint 1 fixed a live bug - every export had rendered in one fallback font regardless of the template - by vendoring real font files and threading the chosen font and size all the way through, then let users pick per clip. Sprint 2 added the viral-caption toolkit: a high-contrast outlined style, a lower-third position, and word-by-word reveal with a pop (which also fixed a caption animation that had quietly done nothing). Sprint 3 gave backgrounds motion - a gently pulsing gradient, and a premium background that draws the song's own waveform reacting in real time. Sprint 4 gathered every control into one collapsible 'Customize' panel with a reset-to-template."),
  bullets([
    "Single source of truth - one module resolves a clip's caption style and another resolves its background, and BOTH the live browser preview and the ffmpeg render read the same resolved values, so what you preview is what you download.",
    "Value ladder preserved - the bold look, outline style, lower third, word-pop, and a pulsing background are free; extra display fonts, the yellow-emphasis style, and audio-reactive waveform backgrounds are premium, all re-checked server-side.",
    "Verified by frames - because captions are burned in, each new style and background is checked by rendering a real clip and inspecting extracted frames (npm run verify:captions), which is how a subtle libass timing bug in the word reveal was caught and fixed.",
  ]),

  h2("Phase 9 - Caption intelligence & one-tap Looks (v1.3)"),
  para("Word-pop looked great but was faked - words appeared on an even split, not the actual singing - because pasted lyrics carry no timing. This phase made it real. When a song is auto-transcribed, Whisper now returns per-word timestamps (stored in a new lyric_words table) so word-pop lands on the vocal, and a premium 'karaoke' style fills each word as it's sung. To make all of this reachable in one tap, curated 'Looks' (Viral, Wave, Sunset, Punchy, Minimal) set a clip's template and every caption control at once."),
  bullets([
    "Foundation-first - Sprint 3.1 shipped the storage and parsing with no behaviour change; Sprint 3.2 then switched the render and preview to consume it, so the risky data work landed separately from the visible feature.",
    "Honest fallback - lyrics without word timing (pasted, no key) simply use the even split, exactly as before; nothing regresses.",
    "Security caught a real gap - the automated suite flagged that the first lyric_words insert policy let another user attach words to your lyric; it was hardened before shipping.",
  ]),

  h2("Phase 10 - Reach: every format, and creative control (v1.4)"),
  para("One clip should post everywhere, and the machine's guesses shouldn't be final. Clips now export in 9:16 (free), plus 1:1, 4:5, and 16:9 (premium) - all from the same source, rendered undistorted by authoring captions at a fixed reference height and deriving the width from the chosen aspect. The live preview takes the shape of the selected format, and the clips library tags each export with its ratio. Users can also nudge a clip's start/end by a second at a time (3-60s, within the song) and 'Regenerate' to re-score from the latest lyrics while keeping any clip they've already exported."),
  bullets([
    "The ladder rides one chokepoint - non-9:16 formats are gated by the same exportTier check that governs every other premium option, so no per-format wiring.",
    "Adjusting a window marks the download stale (reusing the Refresh flow) and drops the machine 'hook score' - once you've hand-picked the moment, the score isn't ours to assert.",
  ]),

  h2("Phase 11 - Recurring revenue & branding (v1.5)"),
  para("The value ladder gained a top rung and a professional finish. A monthly 'Creator' subscription unlocks every song and all premium options through a single early check in the access resolver - one line lights up fonts, styles, formats, templates, no-watermark and full-HD at once, the payoff of routing the whole ladder through one place from the start. Subscribers also get a brand kit: a custom accent colour (which recolours the caption and waveform), a watermark text, and a logo overlaid on their paid exports."),
  bullets([
    "Written server-side only - subscriptions and brand kits are owner-read-only tables that only the Stripe webhook / validated actions write, so a client can't grant itself a plan or brand.",
    "Upload safety - a brand logo is validated by its magic bytes on the server (PNG/JPEG, <=1MB); a renamed .html or an SVG is rejected regardless of its filename.",
    "One item was attempted and deferred - a background render pipeline (so exports show a progress bar and survive heavy jobs) was built and tested on a preview deploy, but this project's Vercel plan has no Fluid Compute to keep a function alive for post-response work, so renders stay synchronous (reliable, and clips are short) until the plan is upgraded or an external queue is added.",
  ]),

  h1("3.  Where the app stands today (v1.5)"),
  para("Every step of the core journey works in live production, and the product now spans the full arc from 'make a clip' to 'run a subscription business on it': discover, sign up, upload, auto-transcribe or tap timing, generate and adjust clips, customize captions and backgrounds, preview in the true export shape, pay per song or subscribe, export in any aspect ratio (watermark-free, HD, brand-stamped for subscribers), and re-find everything in a clips library."),
  h2("Live and working"),
  para("Discovery, accounts and password reset, My songs, upload, lyric entry / timing editors / auto-transcription with per-word timing, rule-based clip generation with window nudging and regenerate, full per-clip caption customization (font, size, style, position, fade/bounce/word-pop/karaoke) with animated and audio-reactive backgrounds and one-tap Looks, multi-format export (9:16/1:1/4:5/16:9), the access gate (founder / first-song-free / single purchase / Creator subscription), real multi-method payments and recurring billing, the brand kit, the My clips library, share + caption helpers, the account area, the navigation shell, and a 38-test security suite running on every change."),
  h2("Small open items (not blockers)"),
  bullets([
    "Auto-transcribe needs an OpenAI key to switch on. It is the optional path; typing or pasting lyrics works fully without it.",
    "Mobile layout is built and code-verified but should get a 60-second look on a real phone (the build environment could not shrink below desktop width).",
    "Two housekeeping items parked by choice: a second founder email still needs to sign up before it can be flagged, and a founder test account is on a temporary password.",
  ]),
  callout("The single highest-value next step is done", ["At the time the journey was first mapped, the biggest gap between 'great demo' and 'can take money' was the Stripe key. That is now connected and verified - the app can accept real payments."]),

  h1("Appendix A.  Chronological commit log"),
  para("Every commit, oldest to newest. Read top-to-bottom, this is the same story as Section 2 at finer grain.", { muted: true }),
  { type: "commitTable", rows: commits },

  h1("Appendix B.  Technical reference (for engineers)"),
  h2("Stack"),
  bullets([
    "Next.js 15 (App Router), React 19, TypeScript, Tailwind v4 - hosted on Vercel.",
    "Supabase - Postgres, Auth, and Storage; sessions via cookies (@supabase/ssr).",
    "Stripe - Checkout + webhooks, SGD, dashboard-controlled payment methods.",
    "ffmpeg (via ffmpeg-static) - trims audio and burns in captions using the libass 'ass' subtitle filter; a bundled Noto Sans font is shipped with the app.",
  ]),
  h2("How data isolation works"),
  para("Every user-owned table (songs, lyrics, lyric_words, clip_segments, payments, exports, profiles, subscriptions, brand_kits, render_jobs) has Row-Level Security enabled with an auth.uid() = user_id policy. Adding a new user-scoped table requires an accompanying RLS migration in the same change. Money- and access-granting tables (subscriptions, brand_kits, render_jobs) are owner READ-only - only the service-role client writes them - so a client can never grant itself a plan or fake a render's status. The service-role key bypasses RLS and is used only server-to-server (the Stripe webhook, the free-song claim, and background writes), never in a request carrying a user session."),
  h2("The access model"),
  para("Centralised in lib/access.ts's evaluateSongAccess - one function every gate consults. A clip's premium options and watermark-free HD download unlock when the account is a founder, OR has an active Creator subscription (which unlocks EVERY song via a single early check), OR the song is the user's one claimed free song, OR a paid payment exists for it. Because every premium feature (fonts, styles, formats, templates, brand kit) routes through this one resolver and the exportTier it returns, adding the subscription lit them all up at once. The is_founder and free_song_id columns are locked at the database grant level so a user cannot self-promote or rotate their free song."),
  h2("The security suite"),
  para("tests/security/ runs on every push/PR via GitHub Actions - 38 tests across data isolation, SQL-injection prevention, brute-force rate-limiting, data-exfiltration prevention, privilege-escalation prevention, and per-table isolation for every feature table (caption styles, per-word timing, export format, render jobs, subscriptions, brand kits). It runs against the real Supabase project with disposable users cleaned up after each run. Uploads add a magic-byte file check (verify:brand) and renders are checked by frame extraction (verify:captions)."),
  h2("Notable production lessons"),
  bullets([
    "Serverless bundles differ from local: file paths, native binaries, and build caches all bit us on the ffmpeg export path.",
    "The prebuilt ffmpeg-static binary lacks the drawtext filter; libass ('ass') is the reliable way to burn captions.",
    "Supabase's service-role key in this project carried a byte-order mark; env parsing must strip it or JWTs silently fail.",
    "Background work (Next after() / waitUntil) needs Vercel Fluid Compute; without it, post-response callbacks don't finish a ~20s encode - caught on a preview deploy before it could affect production, so rendering stayed synchronous.",
    "ASS captions authored at a fixed reference height (with an aspect-derived width) render undistorted across every export ratio - no per-format font/margin math.",
  ]),
  h2("Regenerating this document"),
  para("This PDF and its Markdown twin are generated from one source, docs/build-doc/generate.mjs. To document a new phase: add a milestone status map and the new content blocks there, then run `npm install` (first time) and `node generate.mjs` from docs/build-doc. Both files regenerate in sync."),
];

// ============================================================ SHARED STYLE
const STATUS = {
  live: { fill: "#e6f4ea", stroke: "#3b7a57", text: "#1e4d33", label: "Live", md: "🟢 Live" },
  config: { fill: "#fbf0d9", stroke: "#b8860b", text: "#7a5a08", label: "Built, needs config", md: "🟡 Built, needs config" },
  device: { fill: "#e6eff7", stroke: "#3a6ea5", text: "#23425f", label: "Verify on device", md: "🔵 Verify on device" },
  todo: { fill: "#efece6", stroke: "#c3bdb0", text: "#8a857a", label: "Not built yet", md: "⚪ Not built yet" },
};

// ============================================================ MARKDOWN
function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function renderMD() {
  let m = `# ${META.title} — ${META.subtitle}\n\n`;
  m += `> ${META.tagline}\n\n`;
  m += `**${META.version}**\n\n`;
  m += `- Repository: ${META.repo}\n- Live: ${META.live}\n- Prepared: ${META.date}\n- ${META.author}\n\n`;
  m += `_Status legend: 🟢 live · 🟡 built, needs config · 🔵 verify on device · ⚪ not built yet._\n\n---\n\n`;
  for (const b of BLOCKS) {
    if (b.type === "h1") m += `## ${b.text.trim()}\n\n`;
    else if (b.type === "h2") m += `### ${b.text.trim()}\n\n`;
    else if (b.type === "para") m += `${b.text}\n\n`;
    else if (b.type === "bullets") m += b.items.map((i) => `- ${i}`).join("\n") + "\n\n";
    else if (b.type === "callout") {
      m += b.title ? `> **${b.title}**\n>\n` : "";
      m += b.lines.map((l) => `> ${l}`).join("\n") + "\n\n";
    } else if (b.type === "journey") {
      m += `| Journey step | Status |\n| --- | --- |\n`;
      for (const n of SPINE) m += `| ${n.name} | ${STATUS[b.statusMap[n.k]].md} |\n`;
      for (const n of FOUND) m += `| _${n.name} (foundation)_ | ${STATUS[b.statusMap[n.k]].md} |\n`;
      m += `\n*${b.caption}*\n\n`;
    } else if (b.type === "commitTable") {
      m += `| Date | What changed and why |\n| --- | --- |\n`;
      for (const [d, s] of b.rows) m += `| ${d} | ${s.replace(/\|/g, "\\|")} |\n`;
      m += `\n`;
    }
  }
  writeFileSync(MD_PATH, m, "utf8");
}

// ============================================================ PDF
const INK = "#2b2b2b", MUTED = "#6b675f", FAINT = "#8a857a", RULE = "#d9d3c8", ACCENT = "#b76e79", CREAM = "#f6f1ea";
const PAGE_W = 595.28, PAGE_H = 841.89, ML = 54, MR = 54, MB = 54;
const CONTENT_W = PAGE_W - ML - MR, BOTTOM = PAGE_H - MB;

function renderPDF() {
  const doc = new PDFDocument({ size: "A4", margins: { top: 54, bottom: 54, left: 54, right: 54 }, bufferPages: true });
  doc.pipe(createWriteStream(PDF_PATH));
  let FONT = "Helvetica", BOLD = "Helvetica-Bold", ITAL = "Helvetica-Oblique";
  try {
    if (existsSync("C:/Windows/Fonts/arial.ttf")) { doc.registerFont("body", "C:/Windows/Fonts/arial.ttf"); FONT = "body"; }
    if (existsSync("C:/Windows/Fonts/arialbd.ttf")) { doc.registerFont("bold", "C:/Windows/Fonts/arialbd.ttf"); BOLD = "bold"; }
    if (existsSync("C:/Windows/Fonts/ariali.ttf")) { doc.registerFont("ital", "C:/Windows/Fonts/ariali.ttf"); ITAL = "ital"; }
  } catch {}
  const ensure = (h) => { if (doc.y + h > BOTTOM) doc.addPage(); };

  const NODE_W = 110, NODE_H = 34, COL_STEP = 125, ROW_STEP = 50, X0 = 2;
  const COLS = [X0, X0 + COL_STEP, X0 + 2 * COL_STEP, X0 + 3 * COL_STEP];
  const posOf = (i) => { const row = Math.floor(i / 4), col = row % 2 === 0 ? i % 4 : 3 - (i % 4); return { x: COLS[col], y: 28 + row * ROW_STEP, cx: COLS[col] + NODE_W / 2, cy: 28 + row * ROW_STEP + NODE_H / 2 }; };
  function nodeSVG(x, y, node, status) {
    const s = STATUS[status] || STATUS.todo, dash = status === "todo" ? ` stroke-dasharray="3,2"` : "";
    let t = node.lines.length === 1
      ? `<text x="${x + NODE_W / 2}" y="${y + 21}" font-size="9" text-anchor="middle" fill="${s.text}">${esc(node.lines[0])}</text>`
      : `<text x="${x + NODE_W / 2}" y="${y + 15}" font-size="8.5" text-anchor="middle" fill="${s.text}">${esc(node.lines[0])}</text><text x="${x + NODE_W / 2}" y="${y + 26}" font-size="8.5" text-anchor="middle" fill="${s.text}">${esc(node.lines[1])}</text>`;
    return `<rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="4" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1"${dash}/>${t}`;
  }
  function arrowSVG(from, to) {
    const c = "#9a948a";
    if (from.y === to.y) {
      const r = to.x > from.x, x1 = r ? from.x + NODE_W : from.x, x2 = r ? to.x : to.x + NODE_W, y = from.cy;
      const head = r ? `${x2},${y} ${x2 - 5},${y - 3} ${x2 - 5},${y + 3}` : `${x2},${y} ${x2 + 5},${y - 3} ${x2 + 5},${y + 3}`;
      return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${c}" stroke-width="1.2"/><polygon points="${head}" fill="${c}"/>`;
    }
    const x = from.cx, y1 = from.y + NODE_H, y2 = to.y;
    return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${c}" stroke-width="1.2"/><polygon points="${x},${y2} ${x - 3},${y2 - 5} ${x + 3},${y2 - 5}" fill="${c}"/>`;
  }
  function journeySVG(sm) {
    const W = 487, foundY = 236, H = foundY + NODE_H + 6;
    let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
    [["live", 2], ["config", 122], ["device", 250], ["todo", 378]].forEach(([k, x]) => {
      const st = STATUS[k];
      s += `<rect x="${x}" y="4" width="10" height="10" rx="2" fill="${st.fill}" stroke="${st.stroke}"/><text x="${x + 14}" y="13" font-size="8" fill="${MUTED}">${esc(st.label)}</text>`;
    });
    for (let i = 0; i < SPINE.length - 1; i++) s += arrowSVG(posOf(i), posOf(i + 1));
    for (let i = 0; i < SPINE.length; i++) { const p = posOf(i); s += nodeSVG(p.x, p.y, SPINE[i], sm[SPINE[i].k]); }
    s += `<text x="2" y="${foundY - 6}" font-size="8" fill="${FAINT}">Foundations (cross-cutting)</text>`;
    for (let j = 0; j < FOUND.length; j++) s += nodeSVG(COLS[j], foundY, FOUND[j], sm[FOUND[j].k]);
    return { svg: s + `</svg>`, width: W, height: H };
  }

  // cover
  doc.rect(0, 0, PAGE_W, PAGE_H).fill("#faf7f2");
  doc.rect(0, 0, PAGE_W, 8).fill(ACCENT);
  doc.fillColor(INK).font(BOLD).fontSize(30).text(META.title, ML, 250, { width: CONTENT_W });
  doc.fillColor(ACCENT).font(BOLD).fontSize(15).text(META.subtitle, ML, doc.y + 4, { width: CONTENT_W });
  doc.moveDown(1.2);
  doc.font(FONT).fontSize(11).fillColor(MUTED).text(META.tagline, ML, doc.y, { width: CONTENT_W - 60, lineGap: 3 });
  doc.roundedRect(ML, 470, 260, 30, 6).fill("#e6f4ea");
  doc.font(BOLD).fontSize(12).fillColor("#1e4d33").text(META.version, ML + 12, 479);
  doc.font(FONT).fontSize(10).fillColor(MUTED);
  doc.text(`Repository:  ${META.repo}`, ML, 720);
  doc.text(`Live:  ${META.live}`, ML, doc.y + 2);
  doc.text(`Prepared:  ${META.date}`, ML, doc.y + 2);
  doc.text(META.author, ML, doc.y + 2);

  const h1 = (t) => { doc.addPage(); doc.font(BOLD).fontSize(17).fillColor(INK).text(t, ML, doc.y, { width: CONTENT_W }); doc.moveTo(ML, doc.y + 3).lineTo(ML + CONTENT_W, doc.y + 3).strokeColor(ACCENT).lineWidth(1.5).stroke(); doc.moveDown(0.7); };
  const h2 = (t) => { ensure(28); doc.moveDown(0.3); doc.font(BOLD).fontSize(12).fillColor(INK).text(t, ML, doc.y, { width: CONTENT_W }); doc.moveDown(0.25); };
  const para = (t, o = {}) => { doc.font(FONT).fontSize(o.muted ? 9.5 : 10).fillColor(o.muted ? MUTED : INK).text(t, ML, doc.y, { width: CONTENT_W, lineGap: 2, paragraphGap: 5 }); };
  const bl = (items) => { doc.font(FONT).fontSize(10).fillColor(INK); for (const it of items) { ensure(16); const y = doc.y; doc.text("•", ML + 4, y, { width: 10 }); doc.text(it, ML + 18, y, { width: CONTENT_W - 18, lineGap: 2, paragraphGap: 3 }); } doc.moveDown(0.2); };
  const cal = (title, lines) => {
    doc.font(FONT).fontSize(9.5); const innerW = CONTENT_W - 24, body = lines.join("\n");
    const textH = doc.heightOfString(body, { width: innerW, lineGap: 2 }), titleH = title ? 14 : 0, boxH = textH + titleH + 16;
    ensure(boxH + 6); const x = ML, y = doc.y;
    doc.roundedRect(x, y, CONTENT_W, boxH, 5).fill(CREAM); doc.rect(x, y, 3, boxH).fill(ACCENT);
    let ty = y + 8;
    if (title) { doc.font(BOLD).fontSize(9.5).fillColor(ACCENT).text(title.toUpperCase(), x + 14, ty, { width: innerW, characterSpacing: 0.5 }); ty += titleH; }
    doc.font(FONT).fontSize(9.5).fillColor(INK).text(body, x + 14, ty, { width: innerW, lineGap: 2 });
    doc.y = y + boxH + 8; doc.x = ML;
  };
  const drawJourney = (sm, cap) => {
    const { svg, width, height } = journeySVG(sm); const scale = CONTENT_W / width, rh = height * scale;
    ensure(rh + 20); SVGtoPDF(doc, svg, ML, doc.y, { width: CONTENT_W, height: rh, assumePt: true }); doc.y += rh + 4;
    if (cap) { doc.font(ITAL).fontSize(8.5).fillColor(FAINT).text(cap, ML, doc.y, { width: CONTENT_W, align: "center" }); doc.moveDown(0.4); } doc.x = ML;
  };
  const commitTable = (rows) => {
    const c1 = 70, c2 = CONTENT_W - c1; doc.font(BOLD).fontSize(9).fillColor(MUTED); ensure(20); let y = doc.y;
    doc.text("Date", ML, y, { width: c1 }); doc.text("What changed and why", ML + c1, y, { width: c2 }); y += 14;
    doc.moveTo(ML, y - 2).lineTo(ML + CONTENT_W, y - 2).strokeColor(RULE).lineWidth(0.5).stroke();
    for (const [d, s] of rows) {
      doc.font(FONT).fontSize(9).fillColor(INK); const rh = doc.heightOfString(s, { width: c2 - 6, lineGap: 1.5 });
      if (y + rh + 8 > BOTTOM) { doc.addPage(); y = doc.y; }
      doc.fillColor(FAINT).text(d, ML, y, { width: c1 }); doc.fillColor(INK).text(s, ML + c1, y, { width: c2 - 6, lineGap: 1.5 });
      y += rh + 7; doc.moveTo(ML, y - 3).lineTo(ML + CONTENT_W, y - 3).strokeColor("#efece6").lineWidth(0.5).stroke();
    }
    doc.y = y;
  };

  for (const b of BLOCKS) {
    if (b.type === "h1") h1(b.text);
    else if (b.type === "h2") h2(b.text);
    else if (b.type === "para") para(b.text, b);
    else if (b.type === "bullets") bl(b.items);
    else if (b.type === "callout") cal(b.title, b.lines);
    else if (b.type === "journey") drawJourney(b.statusMap, b.caption);
    else if (b.type === "commitTable") commitTable(b.rows);
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    if (i === range.start) continue;
    doc.switchToPage(i);
    const saved = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.font(FONT).fontSize(8).fillColor(FAINT).text(`Lyric Clip Generator  -  build documentation  -  ${META.versionShort}`, ML, PAGE_H - 38, { width: CONTENT_W, align: "left", lineBreak: false });
    doc.text(`${i - range.start + 1}`, ML, PAGE_H - 38, { width: CONTENT_W, align: "right", lineBreak: false });
    doc.page.margins.bottom = saved;
  }
  doc.end();
}

renderMD();
renderPDF();
console.log("Wrote:\n  " + MD_PATH + "\n  " + PDF_PATH);
