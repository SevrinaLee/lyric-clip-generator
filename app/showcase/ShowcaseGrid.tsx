"use client";

import Link from "next/link";
import { useState } from "react";
import type { ShowcaseCard } from "@/lib/showcase";

const ASPECT: Record<string, string> = {
  "9:16": "aspect-9/16",
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "16:9": "aspect-video",
};

// The gallery grid + "Load more" (cursor pagination). The first page is
// server-rendered (ISR) and passed in; subsequent pages come from /api/showcase.
export function ShowcaseGrid({
  initialCards,
  initialCursor,
}: {
  initialCards: ShowcaseCard[];
  initialCursor: string | null;
}) {
  const [cards, setCards] = useState<ShowcaseCard[]>(initialCards);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/showcase?before=${encodeURIComponent(cursor)}`);
      const body = (await res.json()) as { cards: ShowcaseCard[]; nextBefore: string | null };
      // De-dupe defensively in case an entry straddles the cursor.
      setCards((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...body.cards.filter((c) => !seen.has(c.id))];
      });
      setCursor(body.nextBefore);
    } finally {
      setLoading(false);
    }
  }

  if (cards.length === 0) {
    return (
      <p className="text-center text-ink/50 py-16">
        No featured clips yet — check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {cards.map((c) => (
          <li
            key={c.id}
            className="rounded-2xl overflow-hidden bg-cream-deep border border-ink/10"
          >
            <div className={`${ASPECT[c.format] ?? "aspect-9/16"} bg-ink/90`}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src={c.url}
                className="h-full w-full object-cover"
                controls
                muted
                loop
                playsInline
                preload="metadata"
              />
            </div>
            <div className="p-3 space-y-2">
              <div>
                <p className="text-sm font-semibold text-ink truncate">{c.title}</p>
                <p className="text-xs text-ink/50 truncate">
                  {c.artist ? `${c.artist} · ` : ""}
                  {c.template ?? "Lyric clip"}
                </p>
              </div>
              <Link
                href={c.remixLookId ? `/songs/new?look=${c.remixLookId}` : "/songs/new"}
                className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/70 hover:bg-ink/5 transition-colors"
              >
                🎨 Remix this look
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {cursor && (
        <div className="text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="rounded-full border border-ink/20 px-5 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5 transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
