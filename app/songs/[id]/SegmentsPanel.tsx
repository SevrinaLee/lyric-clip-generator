"use client";

import { useState, useTransition } from "react";
import type { ClipSegment, Export, VideoTemplate } from "@/lib/types";
import { queueExport } from "./actions";
import { PaymentGate } from "./PaymentGate";
import { TemplatePicker } from "./TemplatePicker";
import { ClipPreviewPlayer } from "./ClipPreviewPlayer";

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
  hasPaid,
}: {
  songId: string;
  audioUrl: string | null;
  segments: ClipSegment[];
  templates: VideoTemplate[];
  linesBySegment: Map<string, PreviewLine[]>;
  exportsBySegment: Map<string, Export>;
  hasPaid: boolean;
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
          hasPaid={hasPaid}
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
  hasPaid,
}: {
  songId: string;
  audioUrl: string | null;
  segment: ClipSegment;
  templates: VideoTemplate[];
  lines: PreviewLine[];
  latestExport?: Export;
  hasPaid: boolean;
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

      <div className="flex items-center gap-3">
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

        {status === "done" && exportId && hasPaid && (
          <a
            href={`/api/exports/${exportId}/download`}
            className="text-sm font-semibold text-mauve hover:underline"
          >
            Download
          </a>
        )}
        {status === "failed" && (
          <span className="text-sm text-mauve">Export failed — try again</span>
        )}
      </div>

      {status === "done" && !hasPaid && <PaymentGate songId={songId} />}
    </li>
  );
}
