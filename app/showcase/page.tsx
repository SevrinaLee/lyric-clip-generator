import Link from "next/link";
import type { Metadata } from "next";
import { loadShowcaseCards } from "@/lib/showcase";
import { ShowcaseGrid } from "./ShowcaseGrid";

export const metadata: Metadata = {
  title: "Showcase — Lyric Clip Generator",
  description: "Lyric clips made with Lyric Clip Generator. Turn your song into scroll-stopping captioned clips.",
  openGraph: {
    title: "Lyric Clip Showcase",
    description: "Scroll-stopping lyric clips made by creators. Make your own free.",
    type: "website",
  },
};

// Public gallery of curated (approved) clips. The first page is served
// statically (ISR); "Load more" pages come from /api/showcase. A clip goes
// public only after manual approval (there's no self-approve path).
export const revalidate = 300;

export default async function ShowcasePage() {
  const { cards, nextBefore } = await loadShowcaseCards();

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-32 h-96 w-96 rounded-full bg-mauve/20 blur-3xl"
      />
      <div className="relative max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-8">
        <div className="text-center space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 text-gold px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            ✨ Showcase
          </span>
          <h1 className="font-display text-4xl sm:text-5xl text-ink">
            Clips made by creators
          </h1>
          <p className="text-ink/60 max-w-md mx-auto">
            Real lyric clips made with Lyric Clip Generator. Make yours in
            minutes — the first song is free.
          </p>
          <Link
            href="/songs/new"
            className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-5 py-2.5 text-sm font-semibold hover:bg-ink/85 transition-colors"
          >
            Make your clip
          </Link>
        </div>

        <ShowcaseGrid initialCards={cards} initialCursor={nextBefore} />

        <p className="text-center text-xs text-ink/40">
          Clips are featured with their creator&apos;s permission.
        </p>
      </div>
    </main>
  );
}
