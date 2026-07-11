"use client";

import { useState, useTransition } from "react";
import type { ClipSegment, Export, VideoTemplate } from "@/lib/types";
import type { AccessReason } from "@/lib/access";
import { queueExport } from "./actions";
import { PaymentGate } from "./PaymentGate";
import { TemplatePicker } from "./TemplatePicker";
import { ClipPreviewPlayer } from "./ClipPreviewPlayer";

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
  audioUrl,
  segments,
  templates,
  linesBySegment,
  exportsBySegment,
  unlocked,
  accessReason,
}: {
  songId: string;
  audioUrl: string | null;
  segments: ClipSegment[];
  templates: VideoTemplate[];
  linesBySegment: Map<string, PreviewLine[]>;
  exportsBySegment: Map<string, Export>;
  unlocked: boolean;
  accessReason: AccessReason;
}) {
  return (
    <ul className="space-y-4">
      {segments.map((segment) => (
        <SegmentRow
          key={segment.id}
          songId={songId}
          audioUrl={audioUrl}
          segment={segment}
          templates={templates}
          lines={linesBySegment.get(segment.id) ?? []}
          latestExport={exportsBySegment.get(segment.id)}
          unlocked={unlocked}
          accessReason={accessReason}
        />
      ))}
    </ul>
  );
}

function SegmentRow({
  songId,
  audioUrl,
  segment,
  templates,
  lines,
  latestExport,
  unlocked,
  accessReason,
}: {
  songId: string;
  audioUrl: string | null;
  segment: ClipSegment;
  templates: VideoTemplate[];
  lines: PreviewLine[];
  latestExport?: Export;
  unlocked: boolean;
  accessReason: AccessReason;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(latestExport?.status);
  const [exportId, setExportId] = useState(latestExport?.id);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    segment.template_id,
  );

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  function handleExport() {
    setError(null);
    setStatus("rendering");
    startTransition(async () => {
      try {
        const result = await queueExport(segment.id);
        setExportId(result.id);
        setStatus("done");
      } catch (err) {
        setStatus("failed");
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
        onSelect={setSelectedTemplateId}
      />

      {selectedTemplate && audioUrl && lines.length > 0 && (
        <ClipPreviewPlayer
          audioUrl={audioUrl}
          startMs={segment.start_ms}
          endMs={segment.end_ms}
          lines={lines}
          template={selectedTemplate}
        />
      )}

      {error && <p className="text-sm text-mauve">{error}</p>}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          onClick={handleExport}
          disabled={isPending || status === "rendering" || status === "done"}
          className="rounded-full bg-ink text-cream px-4 py-2 text-sm font-semibold hover:bg-ink/85 transition-colors disabled:opacity-50"
        >
          {status === "rendering"
            ? "Rendering…"
            : status === "done"
              ? "Rendered"
              : "Export"}
        </button>

        {status === "done" && exportId && unlocked && (
          <div className="flex items-center gap-2">
            <a
              href={`/api/exports/${exportId}/download`}
              className="text-sm font-semibold text-mauve hover:underline"
            >
              Download
            </a>
            {UNLOCK_LABEL[accessReason] && (
              <span className="text-xs text-ink/45">
                {UNLOCK_LABEL[accessReason]}
              </span>
            )}
          </div>
        )}
        {status === "failed" && (
          <span className="text-sm text-mauve">Export failed — try again</span>
        )}
      </div>

      {status === "done" && !unlocked && <PaymentGate songId={songId} />}
    </li>
  );
}
