import Link from "next/link";

const singleFeatures = [
  "Unlock every clip for one song",
  "Watermark-free 1080×1920 MP4",
  "All templates & animations",
  "Keep the files forever",
];

const subscriptionFeatures = [
  "Unlimited exports on every song",
  "Watermark-free 1080×1920 MP4s",
  "All templates & animations",
  "New templates as they launch",
  "Cancel anytime from your account",
];

export default function PricingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-32 h-96 w-96 rounded-full bg-sage/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-lavender/40 blur-3xl"
      />

      <div className="relative max-w-3xl mx-auto px-8 py-14 space-y-10">
        <div className="space-y-3 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 text-gold px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            ✦ Pricing
          </span>
          <h1 className="font-display text-4xl sm:text-5xl text-ink">
            Pay per song, or go unlimited
          </h1>
          <p className="text-ink/60 max-w-md mx-auto">
            Previews are always free. You only pay when you want to download
            the finished clips.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <section className="rounded-3xl bg-cream-deep border border-ink/10 p-7 space-y-5 flex flex-col">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-ink/50">
                One-off
              </h2>
              <p className="mt-2">
                <span className="font-display text-4xl text-ink">S$4.99</span>
                <span className="text-ink/50 text-sm"> / song</span>
              </p>
            </div>
            <ul className="space-y-2 text-sm text-ink/70 flex-1">
              {singleFeatures.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-sage">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/songs/new"
              className="block text-center rounded-full border border-ink/20 text-ink px-4 py-2.5 text-sm font-semibold hover:bg-ink/5 transition-colors"
            >
              Start with a song
            </Link>
          </section>

          <section className="relative rounded-3xl bg-ink text-cream p-7 space-y-5 flex flex-col">
            <span className="absolute -top-3 right-6 rounded-full bg-gold text-ink px-3 py-1 text-xs font-bold">
              Best value
            </span>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-cream/50">
                Subscription
              </h2>
              <p className="mt-2">
                <span className="font-display text-4xl">S$14.99</span>
                <span className="text-cream/50 text-sm"> / month</span>
              </p>
            </div>
            <ul className="space-y-2 text-sm text-cream/80 flex-1">
              {subscriptionFeatures.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-gold">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/songs/new"
              className="block text-center rounded-full bg-gold text-ink px-4 py-2.5 text-sm font-semibold hover:bg-gold/85 transition-colors"
            >
              Upload &amp; subscribe
            </Link>
          </section>
        </div>

        <p className="text-center text-sm text-ink/50">
          Pay by card, PayNow QR, or GrabPay — secure checkout via Stripe.
          Checkout happens when you export your first clip — upload a song,
          pick your favorite moment, and choose a plan at the download step.
          Manage or cancel your subscription anytime from{" "}
          <Link href="/account" className="underline underline-offset-2 hover:text-ink">
            your account
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
