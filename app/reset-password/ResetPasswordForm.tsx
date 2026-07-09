"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updatePassword } from "../account/actions";

export function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updatePassword(formData);
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-sage/20 px-4 py-3 text-sm text-ink">
          Password updated — you&apos;re all set.
        </p>
        <Link
          href="/"
          className="inline-block rounded-full bg-ink text-cream px-4 py-2.5 text-sm font-semibold hover:bg-ink/85 transition-colors"
        >
          Go to my songs
        </Link>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1 text-ink/70">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          className="w-full rounded-xl border border-ink/15 bg-cream px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender"
        />
      </div>

      {error && <p className="text-sm text-mauve">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-ink text-cream px-4 py-2.5 text-sm font-semibold hover:bg-ink/85 transition-colors disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
