"use client";

import { useState, useTransition } from "react";
import type { VideoTemplate } from "@/lib/types";
import type { ClipStyleOverrides } from "@/lib/captionStyles";
import {
  availableLooks,
  isLookPremium,
  matchesLook,
  resolveLookTemplate,
  type Look,
} from "@/lib/looks";
import { selectTemplate, updateClipStyle } from "./actions";

// One-tap curated Looks (aesthetics v1.3 S3.3): each sets the clip's template
// + all five caption overrides at once. Premium Looks stay visible but locked
// for unpaid songs; the underlying selectTemplate/updateClipStyle actions
// re-check server-side.
export function LooksRow({
  segmentId,
  templates,
  selectedTemplateId,
  overrides,
  paidTier,
  onApply,
}: {
  segmentId: string;
  templates: VideoTemplate[];
  selectedTemplateId: string | null;
  overrides: ClipStyleOverrides;
  paidTier: boolean;
  onApply: (templateId: string, overrides: ClipStyleOverrides) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const looks = availableLooks(templates);
  if (looks.length === 0) return null;

  function apply(look: Look) {
    const template = resolveLookTemplate(look, templates);
    if (!template) return;
    if (isLookPremium(look, templates) && !paidTier) {
      setError(`${look.name} is a premium look — unlock this song to use it.`);
      return;
    }
    setError(null);
    onApply(template.id, look.overrides);
    startTransition(async () => {
      try {
        await selectTemplate(segmentId, template.id);
        await updateClipStyle(segmentId, look.overrides);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not apply look");
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-xs text-ink/50">One-tap looks</span>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {looks.map((look) => {
          const premium = isLookPremium(look, templates);
          const locked = premium && !paidTier;
          const active = matchesLook(look, selectedTemplateId, overrides, templates);
          return (
            <button
              key={look.id}
              type="button"
              onClick={() => apply(look)}
              disabled={isPending}
              title={locked ? `${look.name} — premium` : look.name}
              className={`relative shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
                active
                  ? "bg-ink text-cream"
                  : "border border-ink/15 text-ink/70 hover:bg-ink/5"
              }`}
            >
              <span aria-hidden>{look.emoji}</span>
              {look.name}
              {locked ? (
                <span aria-hidden>🔒</span>
              ) : premium ? (
                <span aria-hidden className="text-gold">
                  ★
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-mauve">{error}</p>}
    </div>
  );
}
