"use client";

import { useState, useTransition } from "react";
import type { ClipSegment, Export, VideoTemplate } from "@/lib/types";
import type { AccessReason } from "@/lib/access";
import { queueExport } from "./actions";
import { PaymentGate } from "./PaymentGate";
import { TemplatePicker } from "./TemplatePicker";
import { ClipPreviewPlayer } from "./ClipPreviewPlayer";
import { ClipStylePanel } from "./ClipStylePanel";
import { SharePanel } from "./SharePanel";
import { resolveClipStyle, type ClipStyleOverrides } from "@/lib/captionStyles";

const UNLOCK_LABEL: Partial<Record<AccessReason, string>> = {
  founder: "★ Founder access — free",
  "free-song": "✓ Your free song",
  "free-eligible": "✓ Free — uses your one free song",
};

const PLATFORM_ACCENT: Record<string, string> = {
  tiktok: "bg-mauve",
  reels: "bg-sky",
  shorts: "bg-sage",
};

type PreviewLine = { text: string; offsetSeconds: number };

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
  unlocked,
  accessReason,
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
  unlocked: boolean;
  accessReason: AccessReason;
}) {
  return (
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
          unlocked={unlocked}
          accessReason={accessReason}
        />
      ))}
    </ul>
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
  unlocked: boolean;
  accessReason: AccessReason;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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
  });

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const clipStyle = selectedTemplate
    ? resolveClipStyle(selectedTemplate, overrides)
    : null;

  // Staleness is DERIVED (not stored) so it re-evaluates whenever a timing
  // save revalidates the page and pushes a newer lyricsUpdatedAt — the badge
  // then appears without the user touching this clip.
  const renderedAt = locallyRenderedAt ?? latestExport?.created_at ?? null;
  const isStale =
    status === "done" &&
    !!renderedAt &&
    !!lyricsUpdatedAt &&
    new Date(lyricsUpdatedAt).getTime() > new Date(renderedAt).getTime();

  // Shared by the first export and every later refresh. A failed refresh keeps
  // the previous good clip downloadable rather than dropping to a failed state.
  function handleRender() {
    setError(null);
    const isFirst = status !== "done";
    if (isFirst) setStatus("rendering");
    startTransition(async () => {
      try {
        const result = await queueExport(segment.id);
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
        {typeof segment.hook_score === "number" && (
          <span className="text-xs font-bold rounded-full bg-gold/25 text-gold px-2.5 py-1">
            hook {segment.hook_score.toFixed(2)}
          </span>
        )}
      </div>

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
          startMs={segment.start_ms}
          endMs={segment.end_ms}
          lines={lines}
          template={selectedTemplate}
          clipStyle={clipStyle}
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
        />
      )}
    </li>
  );
}
