"use client";

import { useState, useTransition } from "react";
import type { ClipSegment, Export, VideoTemplate } from "@/lib/types";
import { queueExport, selectTemplate } from "./actions";
import { PaymentGate } from "./PaymentGate";

const PLATFORM_ACCENT: Record<string, string> = {
  tiktok: "bg-mauve",
  reels: "bg-sky",
  shorts: "bg-sage",
};

export function SegmentsPanel({
  songId,
  segments,
  templates,
  exportsBySegment,
  hasPaid,
}: {
  songId: string;
  segments: ClipSegment[];
  templates: VideoTemplate[];
  exportsBySegment: Map<string, Export>;
  hasPaid: boolean;
}) {
  return (
    <ul className="space-y-4">
      {segments.map((segment) => (
        <SegmentRow
          key={segment.id}
          songId={songId}
          segment={segment}
          templates={templates}
          latestExport={exportsBySegment.get(segment.id)}
          hasPaid={hasPaid}
        />
      ))}
    </ul>
  );
}

function SegmentRow({
  songId,
  segment,
  templates,
  latestExport,
  hasPaid,
}: {
  songId: string;
  segment: ClipSegment;
  templates: VideoTemplate[];
  latestExport?: Export;
  hasPaid: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(latestExport?.status);
  const [exportId, setExportId] = useState(latestExport?.id);

  function handleTemplateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setError(null);
    startTransition(async () => {
      try {
        await selectTemplate(segment.id, e.target.value);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

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

      <label className="block text-xs text-ink/50">
        Template
        <select
          value={segment.template_id ?? ""}
          onChange={handleTemplateChange}
          disabled={isPending}
          className="mt-1 block w-full rounded-xl border border-ink/15 bg-cream-deep px-2.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender"
        >
          {templates.length === 0 && <option value="">No templates available</option>}
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

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
