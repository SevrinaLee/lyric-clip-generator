"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { signIn, signUp } from "./actions";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("redirectTo", redirectTo);
    startTransition(async () => {
      try {
        if (mode === "login") {
          await signIn(formData);
        } else {
          const result = await signUp(formData);
          if (result?.needsConfirmation) setConfirmationSent(true);
        }
      } catch (err) {
        unstable_rethrow(err);
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  if (confirmationSent) {
    return (
      <p className="rounded-xl bg-sage/20 px-4 py-3 text-sm text-ink">
        Check your email to confirm your account, then log in.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-full bg-ink/5 p-1 text-sm">
        <button
          onClick={() => setMode("login")}
          className={`flex-1 rounded-full py-1.5 font-semibold transition-colors ${mode === "login" ? "bg-cream text-ink shadow-sm" : "text-ink/40"}`}
        >
          Log in
        </button>
        <button
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-full py-1.5 font-semibold transition-colors ${mode === "signup" ? "bg-cream text-ink shadow-sm" : "text-ink/40"}`}
        >
          Sign up
        </button>
      </div>

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
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1 text-ink/70">
            Password
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
          {isPending
            ? "Please wait…"
            : mode === "login"
              ? "Log in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}
