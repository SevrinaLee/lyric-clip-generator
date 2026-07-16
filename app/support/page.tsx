import Link from "next/link";
import type { Metadata } from "next";
import { DonateWidget } from "./DonateWidget";

export const metadata: Metadata = {
  title: "Support · Lyric Clip Generator",
  description:
    "Love the app? Leave a tip to help keep it running and growing — a one-off thank-you, no subscription required.",
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ donated?: string; canceled?: string }>;
}) {
  const { donated, canceled } = await searchParams;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-32 h-96 w-96 rounded-full bg-gold/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-lavender/40 blur-3xl"
      />

      <div className="relative max-w-xl mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-8">
        <div className="space-y-3 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 text-gold px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            💛 Support
          </span>
          <h1 className="font-display text-4xl sm:text-5xl text-ink">
            Buy the app a coffee
          </h1>
          <p className="text-ink/60 max-w-md mx-auto">
            This tool is built and run by a tiny team on a shoestring. If your
            clips made someone stop scrolling, a small tip helps cover the
            servers and keeps new features coming — no subscription needed.
          </p>
        </div>

        {donated && (
          <div className="rounded-2xl bg-sage/20 border border-sage/40 p-4 text-center text-sm text-ink">
            <span className="font-semibold">Thank you so much. 💛</span> Your
            support genuinely keeps this going.
          </div>
        )}
        {canceled && (
          <div className="rounded-2xl bg-ink/5 border border-ink/15 p-4 text-center text-sm text-ink/60">
            No worries — the tip was cancelled and you weren&apos;t charged.
          </div>
        )}

        <section className="rounded-3xl bg-cream-deep border border-ink/10 p-6 sm:p-8 shadow-sm">
          <DonateWidget />
        </section>

        <p className="text-center text-sm text-ink/50">
          Looking to unlock a song or go watermark-free instead?{" "}
          <Link href="/pricing" className="font-semibold text-ink underline">
            See pricing
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
