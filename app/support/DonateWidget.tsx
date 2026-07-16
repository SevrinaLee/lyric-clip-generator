"use client";

import { useState } from "react";

const PRESETS = [
  { cents: 300, label: "S$3", note: "a coffee" },
  { cents: 500, label: "S$5", note: "a boost" },
  { cents: 1000, label: "S$10", note: "a hero" },
];

const MIN = 100;
const MAX = 50000;

export function DonateWidget() {
  const [selected, setSelected] = useState<number>(500);
  const [custom, setCustom] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom (in dollars) wins when it parses to a valid amount.
  const customCents = custom.trim()
    ? Math.round(Number(custom) * 100)
    : null;
  const usingCustom = customCents !== null && !Number.isNaN(customCents);
  const amountCents = usingCustom ? customCents : selected;
  const valid =
    Number.isInteger(amountCents) && amountCents >= MIN && amountCents <= MAX;

  async function donate() {
    setError(null);
    if (!valid) {
      setError("Please choose an amount between S$1 and S$500.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) {
        throw new Error(body.error ?? "Could not start the donation.");
      }
      window.location.href = body.url;
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {PRESETS.map((p) => {
          const active = !usingCustom && selected === p.cents;
          return (
            <button
              key={p.cents}
              type="button"
              onClick={() => {
                setSelected(p.cents);
                setCustom("");
                setError(null);
              }}
              className={`rounded-2xl border px-3 py-4 text-center transition-colors ${
                active
                  ? "border-gold bg-gold/15 ring-2 ring-gold/40"
                  : "border-ink/15 hover:bg-ink/5"
              }`}
            >
              <span className="block font-display text-2xl text-ink">
                {p.label}
              </span>
              <span className="block text-xs text-ink/50">{p.note}</span>
            </button>
          );
        })}
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">
          Or your own amount (S$)
        </span>
        <div className="mt-1 flex items-center rounded-2xl border border-ink/15 focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/30 overflow-hidden">
          <span className="pl-4 pr-1 text-ink/50">S$</span>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            max="500"
            step="1"
            placeholder="25"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setError(null);
            }}
            className="w-full bg-transparent px-1 py-3 outline-none text-ink"
          />
        </div>
      </label>

      <button
        onClick={donate}
        disabled={loading || !valid}
        className="w-full rounded-full bg-ink text-cream px-5 py-3 text-sm font-bold hover:bg-ink/85 transition-colors disabled:opacity-50"
      >
        {loading
          ? "Redirecting…"
          : `Donate ${usingCustom && valid ? `S$${(amountCents / 100).toFixed(2)}` : PRESETS.find((p) => p.cents === selected)?.label ?? ""} 💛`}
      </button>

      {error && <p className="text-sm text-mauve">{error}</p>}

      <p className="text-center text-xs text-ink/45">
        Card · PayNow QR · GrabPay — secure checkout via Stripe. This is a
        one-off tip; it doesn&apos;t unlock songs or start a subscription.
      </p>
    </div>
  );
}
