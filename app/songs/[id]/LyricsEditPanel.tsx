"use client";

import { useState } from "react";
import type { Lyric } from "@/lib/types";
import { EditableLyricsTable, type EditableLine } from "./EditableLyricsTable";
import { TapTimingTool } from "./TapTimingTool";
import { AutoTranscribeButton } from "./AutoTranscribeButton";

export function LyricsEditPanel({
  lyrics,
  audioUrl,
  songId,
  estimatedCount,
  transcribeEnabled,
}: {
  lyrics: EditableLine[];
  audioUrl: string | null;
  songId: string;
  estimatedCount: number;
  transcribeEnabled: boolean;
}) {
  const [showTapTool, setShowTapTool] = useState(false);

  // Captions can only line up with the vocals when lines have real timing.
  // When some/all lines are still estimated, prompt the user to sync — via
  // auto-transcribe (if the server has an OpenAI key) or the tap tool.
  const needsTiming = estimatedCount > 0;
  const allEstimated = estimatedCount >= lyrics.length && lyrics.length > 0;

  return (
    <div className="space-y-3">
      {needsTiming && !showTapTool && (
        <div className="rounded-2xl bg-gold/10 border border-gold/30 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-ink">
              ⏱ Caption timing is estimated
            </p>
            <p className="text-sm text-ink/60 mt-0.5">
              {allEstimated
                ? "These lines have no timing yet, so captions are spread evenly and may not match the vocals."
                : `${estimatedCount} of ${lyrics.length} lines still use estimated timing.`}{" "}
              Sync them so your clips line up with the song.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {audioUrl && (
              <button
                onClick={() => setShowTapTool(true)}
                className="rounded-full bg-ink text-cream px-4 py-2 text-sm font-semibold hover:bg-ink/85 transition-colors"
              >
                ⏱ Tap the timing
              </button>
            )}
            {transcribeEnabled && audioUrl && (
              <AutoTranscribeButton songId={songId} />
            )}
          </div>
        </div>
      )}

      {audioUrl && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowTapTool((v) => !v)}
            className="text-xs font-semibold text-mauve hover:underline"
          >
            {showTapTool ? "← Back to table" : "⏱ Tap timing instead"}
          </button>
        </div>
      )}

      {showTapTool && audioUrl ? (
        <TapTimingTool
          audioUrl={audioUrl}
          lyrics={lyrics as Lyric[]}
          onDone={() => setShowTapTool(false)}
        />
      ) : (
        <EditableLyricsTable lyrics={lyrics} />
      )}
    </div>
  );
}
