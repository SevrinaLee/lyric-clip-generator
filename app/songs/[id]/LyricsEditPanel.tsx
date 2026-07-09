"use client";

import { useState } from "react";
import type { Lyric } from "@/lib/types";
import { EditableLyricsTable, type EditableLine } from "./EditableLyricsTable";
import { TapTimingTool } from "./TapTimingTool";

export function LyricsEditPanel({
  lyrics,
  audioUrl,
}: {
  lyrics: EditableLine[];
  audioUrl: string | null;
}) {
  const [showTapTool, setShowTapTool] = useState(false);

  return (
    <div className="space-y-3">
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
