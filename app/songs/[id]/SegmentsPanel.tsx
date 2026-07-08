"use client";

import { useState, useTransition } from "react";
import type { ClipSegment, Export, VideoTemplate } from "@/lib/types";
import { queueExport, selectTemplate } from "./actions";
import { PaymentGate } from "./PaymentGate";

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
    <li className="rounded-lg border border-neutral-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium">{segment.label}</span>
          <span className="text-neutral-400 text-sm ml-2">
            {segment.platform}
          </span>
        </div>
        {typeof segment.hook_score === "number" && (
          <span className="text-xs font-medium rounded bg-neutral-800 text-white px-2 py-1">
            hook {segment.hook_score.toFixed(2)}
          </span>
        )}
      </div>

      <label className="block text-xs text-neutral-500">
        Template
        <select
          value={segment.template_id ?? ""}
          onChange={handleTemplateChange}
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          {templates.length === 0 && <option value="">No templates available</option>}
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleExport}
          disabled={isPending || status === "rendering" || status === "done"}
          className="rounded-md bg-black text-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
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
            className="text-sm text-blue-600 hover:underline"
          >
            Download
          </a>
        )}
        {status === "failed" && (
          <span className="text-sm text-red-600">
            Export failed — try again
          </span>
        )}
      </div>

      {status === "done" && !hasPaid && <PaymentGate songId={songId} />}
    </li>
  );
}
