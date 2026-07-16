"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClipSegment, Export, VideoTemplate } from "@/lib/types";
import type { AccessReason } from "@/lib/access";
import {
  queueExport,
  updateSegmentWindow,
  regenerateClips,
  duplicateSegment,
  selectTemplate,
  updateClipStyle,
} from "./actions";
import { LOOKS, availableLooks, isLookPremium } from "@/lib/looks";
import { PaymentGate } from "./PaymentGate";
import { TemplatePicker } from "./TemplatePicker";
import { LooksRow } from "./LooksRow";
import { ClipPreviewPlayer } from "./ClipPreviewPlayer";
import { ClipStylePanel } from "./ClipStylePanel";
import { SharePanel } from "./SharePanel";
import { resolveClipStyle, type ClipStyleOverrides } from "@/lib/captionStyles";
import type { PreviewLine } from "@/lib/scoring";
import {
  FORMAT_PRESETS,
  CLIP_FORMATS,
  DEFAULT_FORMAT,
  type ClipFormat,
} from "@/lib/formats";

const UNLOCK_LABEL: Partial<Record<AccessReason, string>> = {
  founder: "★ Founder access — free",
  subscriber: "★ Creator plan",
  "free-song": "✓ Your free song",
  "free-eligible": "✓ Free — uses your one free song",
};

const PLATFORM_ACCENT: Record<string, string> = {
  tiktok: "bg-mauve",
  reels: "bg-sky",
  shorts: "bg-sage",
};

export function SegmentsPanel({
  songId,
  songTitle,
  songArtist,
  audioUrl,
  segments,
  templates,
  linesBySegment,
  exportsBySegment,
  lyricsUpdatedAt,
  songDurationSeconds,
  unlocked,
  accessReason,
  remixLookId = null,
}: {
  songId: string;
  songTitle: string;
  songArtist: string;
  audioUrl: string | null;
  segments: ClipSegment[];
  templates: VideoTemplate[];
  linesBySegment: Map<string, PreviewLine[]>;
  exportsBySegment: Map<string, Export>;
  lyricsUpdatedAt: string | null;
  songDurationSeconds: number | null;
  unlocked: boolean;
  accessReason: AccessReason;
  /** Look id carried from a "Remix" deep-link (showcase → new song). */
  remixLookId?: string | null;
}) {
  const paidTier = accessReason === "founder" || accessReason === "paid";
  return (
    <div className="space-y-3">
      <RemixBanner
        remixLookId={remixLookId}
        segmentIds={segments.map((s) => s.id)}
        templates={templates}
        paidTier={paidTier}
      />
      <div className="flex justify-end">
        <RegenerateButton songId={songId} />
      </div>
      <ul className="space-y-4">
        {segments.map((segment) => (
          <SegmentRow
            key={segment.id}
            songId={songId}
            songTitle={songTitle}
            songArtist={songArtist}
            audioUrl={audioUrl}
            segment={segment}
            templates={templates}
            lines={linesBySegment.get(segment.id) ?? []}
            latestExport={exportsBySegment.get(segment.id)}
            lyricsUpdatedAt={lyricsUpdatedAt}
            songDurationSeconds={songDurationSeconds}
            unlocked={unlocked}
            accessReason={accessReason}
          />
        ))}
      </ul>
    </div>
  );
}

function RegenerateButton({ songId }: { songId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRegenerate() {
    if (
      !window.confirm(
        "Re-suggest clips from your latest lyrics? Clips you've already exported are kept; the rest are replaced.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      try {
        await regenerateClips(songId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not regenerate");
      }
    });
  }

  return (
    <div className="text-right">
      <button
        onClick={handleRegenerate}
        disabled={isPending}
        className="text-xs font-semibold text-ink/50 hover:text-ink hover:underline disabled:opacity-50"
      >
        {isPending ? "Regenerating…" : "↻ Regenerate clips"}
      </button>
      {error && <p className="text-sm text-mauve">{error}</p>}
    </div>
  );
}

// Remix banner (v1.7 S7.4): when the user arrived via a "Remix this look"
// deep-link from the showcase (?look=<id>), offer to apply that Look to every
// clip in one tap. The Look id is validated against the available Looks; an
// unknown or premium-locked (for a free song) id simply renders nothing.
function RemixBanner({
  remixLookId,
  segmentIds,
  templates,
  paidTier,
}: {
  remixLookId: string | null;
  segmentIds: string[];
  templates: VideoTemplate[];
  paidTier: boolean;
}) {
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const look = remixLookId
    ? availableLooks(templates).find((l) => l.id === remixLookId)
    : undefined;
  if (!look || dismissed || segmentIds.length === 0) return null;
  const locked = isLookPremium(look, templates) && !paidTier;

  function apply() {
    if (!look) return;
    const template = templates.find((t) => t.name === look.templateName);
    if (!template) return;
    const overrides = {
      ...look.overrides,
      custom_bg_c0: null,
      custom_bg_c1: null,
      custom_caption_color: null,
    };
    startTransition(async () => {
      for (const id of segmentIds) {
        await selectTemplate(id, template.id);
        await updateClipStyle(id, overrides);
      }
      setDone(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-lavender/15 border border-lavender/40 px-4 py-3">
      <span className="text-sm text-ink">
        <span className="font-semibold">
          {look.emoji} Remixing the {look.name} look.
        </span>{" "}
        {done
          ? "Applied to every clip ✓"
          : locked
            ? "It’s a premium look — unlock this song to apply it."
            : "Apply it to every clip in one tap?"}
      </span>
      {!done && !locked && (
        <button
          onClick={apply}
          disabled={isPending}
          className="ml-auto rounded-full bg-ink text-cream px-4 py-1.5 text-xs font-bold hover:bg-ink/85 transition-colors disabled:opacity-50"
        >
          {isPending ? "Applying…" : "Apply to all clips"}
        </button>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="text-ink/40 hover:text-ink text-sm"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

function SegmentRow({
  songId,
  songTitle,
  songArtist,
  audioUrl,
  segment,
  templates,
  lines,
  latestExport,
  lyricsUpdatedAt,
  songDurationSeconds,
  unlocked,
  accessReason,
}: {
  songId: string;
  songTitle: string;
  songArtist: string;
  audioUrl: string | null;
  segment: ClipSegment;
  templates: VideoTemplate[];
  lines: PreviewLine[];
  latestExport?: Export;
  lyricsUpdatedAt: string | null;
  songDurationSeconds: number | null;
  unlocked: boolean;
  accessReason: AccessReason;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [duplicating, setDuplicating] = useState(false);
  const [status, setStatus] = useState(latestExport?.status);
  const [exportId, setExportId] = useState(latestExport?.id);
  // When null we trust the server export's created_at; set to now() after a
  // refresh in this session so the stale check clears immediately.
  const [locallyRenderedAt, setLocallyRenderedAt] = useState<string | null>(
    null,
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    segment.template_id,
  );
  // Per-clip caption overrides, kept in client state so the preview updates
  // instantly; persisted through the updateClipStyle action by ClipStylePanel.
  const [overrides, setOverrides] = useState<ClipStyleOverrides>({
    caption_font: segment.caption_font ?? null,
    caption_size: segment.caption_size ?? null,
    caption_position: segment.caption_position ?? null,
    caption_style_preset: segment.caption_style_preset ?? null,
    caption_animation: segment.caption_animation ?? null,
    // Custom colors (S7.2) — background pair + caption color; null = inherit.
    custom_bg_c0: segment.custom_bg_c0 ?? null,
    custom_bg_c1: segment.custom_bg_c1 ?? null,
    custom_caption_color: segment.custom_caption_color ?? null,
  });
  const [format, setFormat] = useState<ClipFormat>(DEFAULT_FORMAT);
  // Local clip window (optimistic) so nudges update the preview instantly;
  // persisted via updateSegmentWindow. windowEditedAt marks the download stale
  // when the window changes after a render (same-session).
  const [startMs, setStartMs] = useState(segment.start_ms);
  const [endMs, setEndMs] = useState(segment.end_ms);
  const [windowEditedAt, setWindowEditedAt] = useState<string | null>(null);

  const paidTier = accessReason === "founder" || accessReason === "paid";
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const clipStyle = selectedTemplate
    ? resolveClipStyle(selectedTemplate, overrides)
    : null;

  // Staleness is DERIVED (not stored) so it re-evaluates whenever a timing
  // save revalidates the page and pushes a newer lyricsUpdatedAt — the badge
  // then appears without the user touching this clip.
  const renderedAt = locallyRenderedAt ?? latestExport?.created_at ?? null;
  const editedAfterRender = (at: string | null) =>
    !!renderedAt && !!at && new Date(at).getTime() > new Date(renderedAt).getTime();
  const isStale =
    status === "done" &&
    (editedAfterRender(lyricsUpdatedAt) || editedAfterRender(windowEditedAt));

  const windowSeconds = (endMs - startMs) / 1000;
  const fmtTime = (ms: number) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const durationMs = songDurationSeconds ? Math.round(songDurationSeconds * 1000) : null;

  // Nudge one edge by delta ms, respecting the 3–60s window + song bounds, then
  // persist. Optimistic local update keeps the preview in sync instantly.
  function nudge(edge: "start" | "end", deltaMs: number) {
    let nextStart = startMs;
    let nextEnd = endMs;
    if (edge === "start") nextStart = Math.max(0, startMs + deltaMs);
    else nextEnd = endMs + deltaMs;
    if (durationMs) nextEnd = Math.min(nextEnd, durationMs);
    const win = nextEnd - nextStart;
    if (win < 3000 || win > 60000) return; // clamp: ignore out-of-range nudges
    setStartMs(nextStart);
    setEndMs(nextEnd);
    setError(null);
    setWindowEditedAt(new Date().toISOString());
    startTransition(async () => {
      try {
        await updateSegmentWindow(segment.id, nextStart, nextEnd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not adjust window");
      }
    });
  }

  // Shared by the first export and every later refresh. A failed refresh keeps
  // the previous good clip downloadable rather than dropping to a failed state.
  function handleDuplicate() {
    setError(null);
    setDuplicating(true);
    startTransition(async () => {
      try {
        await duplicateSegment(segment.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not duplicate clip");
      } finally {
        setDuplicating(false);
      }
    });
  }

  function handleRender() {
    setError(null);
    const isFirst = status !== "done";
    if (isFirst) setStatus("rendering");
    startTransition(async () => {
      try {
        const result = await queueExport(segment.id, format);
        setExportId(result.id);
        setStatus("done");
        setLocallyRenderedAt(new Date().toISOString());
      } catch (err) {
        setStatus(isFirst ? "failed" : "done");
        setError(err instanceof Error ? err.message : "Export failed");
      }
    });
  }

  return (
    <li className="relative overflow-hidden rounded-2xl bg-cream border border-ink/10 p-4 pl-5 space-y-3">
      <span
        className={`absolute left-0 top-0 bottom-0 w-1.5 ${PLATFORM_ACCENT[segment.platform] ?? "bg-ink/20"}`}
      />

      <div className="flex items-center justify-between">
        <div>
          <span className="font-semibold text-ink">{segment.label}</span>
          <span className="text-ink/40 text-sm ml-2">{segment.platform}</span>
        </div>
        {typeof segment.hook_score === "number" &&
          segment.hook_score_review_status !== "user-adjusted" && (
            <span className="text-xs font-bold rounded-full bg-gold/25 text-gold px-2.5 py-1">
              hook {segment.hook_score.toFixed(2)}
            </span>
          )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/60">
        <div className="flex items-center gap-1">
          <span className="text-ink/45">Start</span>
          <button
            type="button"
            onClick={() => nudge("start", -1000)}
            disabled={isPending}
            className="h-6 w-6 rounded-full border border-ink/15 hover:bg-ink/5 disabled:opacity-40"
          >
            −
          </button>
          <span className="tabular-nums font-semibold text-ink w-9 text-center">
            {fmtTime(startMs)}
          </span>
          <button
            type="button"
            onClick={() => nudge("start", 1000)}
            disabled={isPending}
            className="h-6 w-6 rounded-full border border-ink/15 hover:bg-ink/5 disabled:opacity-40"
          >
            +
          </button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-ink/45">End</span>
          <button
            type="button"
            onClick={() => nudge("end", -1000)}
            disabled={isPending}
            className="h-6 w-6 rounded-full border border-ink/15 hover:bg-ink/5 disabled:opacity-40"
          >
            −
          </button>
          <span className="tabular-nums font-semibold text-ink w-9 text-center">
            {fmtTime(endMs)}
          </span>
          <button
            type="button"
            onClick={() => nudge("end", 1000)}
            disabled={isPending}
            className="h-6 w-6 rounded-full border border-ink/15 hover:bg-ink/5 disabled:opacity-40"
          >
            +
          </button>
        </div>
        <span className="text-ink/40 tabular-nums">
          {windowSeconds.toFixed(0)}s clip
        </span>
      </div>

      <LooksRow
        segmentId={segment.id}
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        overrides={overrides}
        paidTier={accessReason === "founder" || accessReason === "paid"}
        onApply={(templateId, next) => {
          setSelectedTemplateId(templateId);
          setOverrides(next);
        }}
      />

      <TemplatePicker
        segmentId={segment.id}
        templates={templates}
        selectedId={selectedTemplateId}
        paidTier={accessReason === "founder" || accessReason === "paid"}
        onSelect={setSelectedTemplateId}
      />

      {selectedTemplate && (
        <ClipStylePanel
          segmentId={segment.id}
          template={selectedTemplate}
          initial={overrides}
          paidTier={accessReason === "founder" || accessReason === "paid"}
          onChange={setOverrides}
        />
      )}

      {selectedTemplate && clipStyle && audioUrl && lines.length > 0 && (
        <ClipPreviewPlayer
          audioUrl={audioUrl}
          startMs={startMs}
          endMs={endMs}
          lines={lines}
          template={selectedTemplate}
          clipStyle={clipStyle}
          bgColors={overrides}
          format={format}
        />
      )}

      {error && <p className="text-sm text-mauve">{error}</p>}

      {isStale && (
        <p className="flex items-start gap-2 rounded-xl bg-gold/15 border border-gold/30 px-3 py-2 text-xs text-ink/70">
          <span aria-hidden className="text-gold font-bold">
            ↻
          </span>
          <span>
            You&apos;ve edited lyric timing since this clip was rendered. The
            preview above already reflects your latest saved timing — refresh to
            update the downloadable clip to match.
          </span>
        </p>
      )}

      <div className="space-y-1">
        <span className="block text-xs text-ink/50">Export format</span>
        <div className="flex flex-wrap gap-1.5">
          {CLIP_FORMATS.map((f) => {
            const preset = FORMAT_PRESETS[f];
            const locked = preset.isPremium && !paidTier;
            return (
              <button
                key={f}
                type="button"
                onClick={() => {
                  if (locked) {
                    setError("This aspect ratio is premium — unlock this song.");
                    return;
                  }
                  setError(null);
                  setFormat(f);
                }}
                title={preset.hint}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  format === f
                    ? "bg-ink text-cream"
                    : "border border-ink/15 text-ink/70 hover:bg-ink/5"
                }`}
              >
                {preset.label}
                {locked ? " 🔒" : preset.isPremium ? " ★" : ""}
              </button>
            );
          })}
        </div>
        {format !== DEFAULT_FORMAT && (
          <p className="text-[11px] text-ink/40">
            The preview above matches this {format} format.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {status !== "done" ? (
          <button
            onClick={handleRender}
            disabled={isPending || status === "rendering"}
            className="rounded-full bg-ink text-cream px-4 py-2 text-sm font-semibold hover:bg-ink/85 transition-colors disabled:opacity-50"
          >
            {status === "rendering" ? "Rendering…" : "Export"}
          </button>
        ) : (
          <>
            <button
              onClick={handleRender}
              disabled={isPending}
              title="Re-render this clip from your latest saved lyric timing"
              className={
                isStale
                  ? "rounded-full bg-gold text-ink px-4 py-2 text-sm font-semibold hover:bg-gold/85 transition-colors disabled:opacity-50"
                  : "rounded-full border border-ink/20 text-ink px-4 py-2 text-sm font-semibold hover:bg-ink/5 transition-colors disabled:opacity-50"
              }
            >
              {isPending
                ? "Refreshing…"
                : isStale
                  ? "↻ Refresh clip"
                  : "↻ Refresh"}
            </button>

            {exportId && unlocked && (
              <div className="flex items-center gap-2">
                <a
                  href={`/api/exports/${exportId}/download`}
                  className={`text-sm font-semibold hover:underline ${
                    isStale ? "text-ink/40" : "text-mauve"
                  }`}
                >
                  Download
                </a>
                <a
                  href={`/api/exports/${exportId}/gif`}
                  title="Download a short looping GIF of this clip"
                  className="text-xs font-semibold text-ink/45 hover:text-ink hover:underline"
                >
                  GIF
                </a>
                {isStale ? (
                  <span className="text-xs font-semibold text-gold">
                    outdated
                  </span>
                ) : (
                  UNLOCK_LABEL[accessReason] && (
                    <span className="text-xs text-ink/45">
                      {UNLOCK_LABEL[accessReason]}
                    </span>
                  )
                )}
              </div>
            )}
          </>
        )}

        <button
          onClick={handleDuplicate}
          disabled={isPending}
          title="Make a copy of this clip to try a different style"
          className="rounded-full border border-ink/15 text-ink/60 px-3 py-2 text-xs font-semibold hover:bg-ink/5 transition-colors disabled:opacity-50"
        >
          {duplicating ? "Duplicating…" : "⧉ Duplicate"}
        </button>

        {status === "failed" && (
          <span className="text-sm text-mauve">Export failed — try again</span>
        )}
      </div>

      {status === "done" && !isStale && (
        <p className="text-xs text-ink/45">
          ✓ This clip reflects your latest saved timing
        </p>
      )}

      {status === "done" && !unlocked && <PaymentGate songId={songId} />}

      {status === "done" && (
        <SharePanel
          title={songTitle}
          artist={songArtist}
          platform={segment.platform}
          hookLine={lines[0]?.text}
          format={format}
          exportId={exportId}
        />
      )}
    </li>
  );
}
