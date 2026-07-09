"use client";

import { useState, useTransition } from "react";
import { updatePassword } from "./actions";

export function PasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSavedOk(false);
    startTransition(async () => {
      try {
        await updatePassword(formData);
        setSavedOk(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3 max-w-xs">
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
      {savedOk && <p className="text-sm text-sage">Password updated.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-ink text-cream px-4 py-2 text-sm font-semibold hover:bg-ink/85 transition-colors disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
