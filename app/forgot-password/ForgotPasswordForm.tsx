"use client";

import { useState, useTransition } from "react";
import { requestPasswordReset } from "../login/actions";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await requestPasswordReset(formData);
        setSent(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  if (sent) {
    return (
      <p className="rounded-xl bg-sage/20 px-4 py-3 text-sm text-ink">
        If an account exists for that email, a reset link is on its way. Open
        it on this device to set a new password.
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1 text-ink/70">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-xl border border-ink/15 bg-cream px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender"
        />
      </div>

      {error && <p className="text-sm text-mauve">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-ink text-cream px-4 py-2.5 text-sm font-semibold hover:bg-ink/85 transition-colors disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
