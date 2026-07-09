"use client";

import { useState } from "react";

export function BillingButton() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.url) {
        throw new Error(body.error ?? "Could not open billing portal");
      }
      window.location.href = body.url;
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-full border border-ink/20 text-ink px-4 py-2 text-sm font-semibold hover:bg-ink/5 transition-colors disabled:opacity-50"
      >
        {loading ? "Opening…" : "Manage billing"}
      </button>
      {error && <p className="text-sm text-mauve mt-2">{error}</p>}
    </div>
  );
}
