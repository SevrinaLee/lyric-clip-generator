"use client";

import { useState } from "react";

export function PaymentGate({ songId }: { songId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<
    "single" | "subscription" | null
  >(null);

  async function startCheckout(plan: "single" | "subscription") {
    setError(null);
    setLoadingPlan(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, plan }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) {
        throw new Error(body.error ?? "Could not start checkout");
      }
      window.location.href = body.url;
    } catch (err) {
      setLoadingPlan(null);
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-2xl bg-gold/10 border border-gold/25 p-3">
      <button
        onClick={() => startCheckout("single")}
        disabled={loadingPlan !== null}
        className="rounded-full bg-gold text-ink px-4 py-2 text-sm font-semibold hover:bg-gold/85 transition-colors disabled:opacity-50"
      >
        {loadingPlan === "single" ? "Redirecting…" : "Pay $4.99 to download"}
      </button>
      <button
        onClick={() => startCheckout("subscription")}
        disabled={loadingPlan !== null}
        className="rounded-full border border-ink/20 text-ink px-4 py-2 text-sm font-semibold hover:bg-ink/5 transition-colors disabled:opacity-50"
      >
        {loadingPlan === "subscription"
          ? "Redirecting…"
          : "Subscribe $14.99/mo"}
      </button>
      {error && <p className="text-sm text-mauve w-full">{error}</p>}
    </div>
  );
}
