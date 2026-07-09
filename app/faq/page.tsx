import Link from "next/link";

const faqs: { q: string; a: string }[] = [
  {
    q: "What does Lyric Clip Generator actually do?",
    a: "Upload any audio — an original song, cover, poem, or podcast — add your lyrics, and it finds the most hook-worthy moments and turns them into vertical 1080×1920 clips with animated captions, ready for TikTok, Reels, and Shorts.",
  },
  {
    q: "Do I need any editing skills?",
    a: "No. Everything happens in the browser: upload the audio, paste or type the lyrics, and the app handles timing, styling, and rendering. If the automatic timing isn't perfect, you can fine-tune it by hand or use the tap-to-time tool while the song plays.",
  },
  {
    q: "How does the timing of the lyrics work?",
    a: "The app estimates line timing from the song length automatically. For exact sync, open the lyrics editor and either type start/end times per line, or use Tap timing: play the song and tap (or press spacebar) at the start of each line.",
  },
  {
    q: "What are hook scores?",
    a: "Each candidate clip gets a 0–1 score estimating how likely that moment is to stop the scroll — based on things like repetition, energy, and where the section sits in the song. Higher is better, but you always choose which clip to export.",
  },
  {
    q: "Is previewing free?",
    a: "Yes. Uploading, editing lyrics, generating clips, and previewing them with any template is completely free. You only pay when you want to download the final video file.",
  },
  {
    q: "How much does exporting cost?",
    a: "Either S$4.99 once to unlock all exports for a single song, or S$14.99/month for unlimited exports across all your songs. See the Pricing page for details.",
  },
  {
    q: "What payment methods are accepted?",
    a: "Checkout is powered by Stripe and accepts credit/debit cards, PayNow QR, and GrabPay. Subscriptions renew automatically and require a card; one-off song unlocks work with any of the methods.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "Go to Account → Billing → Manage billing. That opens the Stripe portal where you can cancel, update your card, or view invoices. You keep access until the end of the billing period.",
  },
  {
    q: "What audio formats can I upload?",
    a: "MP3 and WAV files up to 50MB. That covers roughly a full-length song at standard quality.",
  },
  {
    q: "Who owns the clips I make?",
    a: "You do. The app doesn't add watermarks or claim any rights. Just make sure you have the rights to the audio you upload — original work and covers you're licensed for are fine.",
  },
  {
    q: "Can other people see my songs?",
    a: "No. Songs you upload are private to your account. The demo songs on the homepage are the only publicly visible ones.",
  },
];

export default function FaqPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-32 h-96 w-96 rounded-full bg-rose/30 blur-3xl"
      />

      <div className="relative max-w-2xl mx-auto px-8 py-14 space-y-10">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lavender/30 text-ink px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            ✦ FAQ
          </span>
          <h1 className="font-display text-4xl sm:text-5xl text-ink">
            Frequently asked questions
          </h1>
        </div>

        <div className="space-y-3">
          {faqs.map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-2xl bg-cream-deep border border-ink/10 px-5 py-4 open:pb-5"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-sm font-semibold text-ink">
                {q}
                <span className="text-ink/40 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink/60">{a}</p>
            </details>
          ))}
        </div>

        <p className="text-center text-sm text-ink/50">
          Ready to try it?{" "}
          <Link
            href="/songs/new"
            className="underline underline-offset-2 hover:text-ink"
          >
            Upload your first song
          </Link>{" "}
          — previews are free.
        </p>
      </div>
    </main>
  );
}
