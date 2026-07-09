"use client";

import { useState, useTransition } from "react";
import { updateDisplayName } from "./actions";

export function DisplayNameForm({ initialName }: { initialName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSavedOk(false);
    startTransition(async () => {
      try {
        await updateDisplayName(formData);
        setSavedOk(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3 max-w-xs">
      <div>
        <label
          htmlFor="display_name"
          className="block text-sm font-medium mb-1 text-ink/70"
        >
          Name / nickname
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          maxLength={50}
          defaultValue={initialName}
          placeholder="How should we call you?"
          className="w-full rounded-xl border border-ink/15 bg-cream px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender"
        />
      </div>
      {error && <p className="text-sm text-mauve">{error}</p>}
      {savedOk && <p className="text-sm text-sage">Name saved.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-ink text-cream px-4 py-2 text-sm font-semibold hover:bg-ink/85 transition-colors disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}
