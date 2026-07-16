import Link from "next/link";
import { Suspense } from "react";
import { NewSongForm } from "./NewSongForm";

export default function NewSongPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-32 h-96 w-96 rounded-full bg-sky/35 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 -left-24 h-72 w-72 rounded-full bg-tan/30 blur-3xl"
      />

      <div className="relative max-w-lg mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-6">
        <Link href="/" className="text-sm text-ink/50 hover:text-ink">
          ← Back
        </Link>
        <h1 className="font-display text-4xl text-ink">New song</h1>

        <div className="rounded-3xl bg-cream-deep border border-ink/10 p-6 sm:p-8 shadow-[0_20px_48px_-24px_rgba(43,43,43,0.35)]">
          <Suspense fallback={null}>
            <NewSongForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
