import Link from "next/link";
import { EFFECTIVE_DATE } from "./content";

// Shared shell for the Privacy Policy and Terms pages: a readable single column
// with consistent heading/paragraph styling.
export function LegalLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-32 h-96 w-96 rounded-full bg-lavender/25 blur-3xl"
      />
      <div className="relative max-w-2xl mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-6">
        <Link href="/" className="text-sm text-ink/50 hover:text-ink">
          ← Back
        </Link>
        <div className="space-y-2">
          <h1 className="font-display text-3xl sm:text-4xl text-ink">{title}</h1>
          <p className="text-xs text-ink/45">Effective {EFFECTIVE_DATE}</p>
        </div>
        <p className="text-ink/70">{intro}</p>
        <div className="space-y-6 text-sm leading-relaxed text-ink/70 [&_h2]:font-display [&_h2]:text-lg [&_h2]:text-ink [&_h2]:mt-6 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:underline [&_a]:text-ink">
          {children}
        </div>
        <div className="pt-6 border-t border-ink/10 text-xs text-ink/40 flex gap-4">
          <Link href="/privacy" className="hover:text-ink">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms of Service
          </Link>
          <Link href="/support" className="hover:text-ink">
            Support
          </Link>
        </div>
      </div>
    </main>
  );
}
