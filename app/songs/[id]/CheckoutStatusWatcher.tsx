"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * After a Stripe Checkout redirect, the webhook that flips payments.status
 * to "paid" can land a beat after the browser does. Polls briefly and
 * refreshes the page's server data once it catches up, instead of making
 * the user manually reload to see their unlocked download.
 */
export function CheckoutStatusWatcher({ songId }: { songId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  const [message, setMessage] = useState<string | null>(
    checkout === "success"
      ? "Payment received — unlocking your download…"
      : checkout === "canceled"
        ? "Checkout canceled — you can try again anytime."
        : null,
  );

  useEffect(() => {
    if (checkout !== "success") return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const res = await fetch(`/api/songs/${songId}/payment-status`);
      const { paid } = await res.json();
      if (paid) {
        clearInterval(interval);
        setMessage(null);
        router.replace(`/songs/${songId}`);
        router.refresh();
      } else if (attempts >= 8) {
        clearInterval(interval);
        setMessage(
          "Payment is processing — refresh in a few seconds if the download doesn't unlock.",
        );
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [checkout, songId, router]);

  if (!message) return null;
  return (
    <p className="rounded-xl bg-sage/20 px-4 py-3 text-sm text-ink">
      {message}
    </p>
  );
}
