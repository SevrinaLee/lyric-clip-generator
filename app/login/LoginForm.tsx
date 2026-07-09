"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { signIn, signInWithGoogle, signUp } from "./actions";

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
      <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
        Check your email to confirm your account, then log in.
      </p>
    );
  }

  function handleGoogle() {
    setError(null);
    startTransition(async () => {
      try {
        await signInWithGoogle(redirectTo);
      } catch (err) {
        unstable_rethrow(err);
        setError(
          err instanceof Error
            ? err.message
            : "Google sign-in isn't configured yet",
        );
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-4 text-sm border-b border-neutral-200">
        <button
          onClick={() => setMode("login")}
          className={`pb-2 -mb-px border-b-2 ${mode === "login" ? "border-black font-medium" : "border-transparent text-neutral-400"}`}
        >
          Log in
        </button>
        <button
          onClick={() => setMode("signup")}
          className={`pb-2 -mb-px border-b-2 ${mode === "signup" ? "border-black font-medium" : "border-transparent text-neutral-400"}`}
        >
          Sign up
        </button>
      </div>

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-black text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
        >
          {isPending
            ? "Please wait…"
            : mode === "login"
              ? "Log in"
              : "Create account"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" />
        or
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <button
        onClick={handleGoogle}
        disabled={isPending}
        className="w-full rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        Continue with Google
      </button>
    </div>
  );
}
