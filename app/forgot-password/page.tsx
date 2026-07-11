import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="relative min-h-screen overflow-hidden flex flex-col justify-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-lavender/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-rose/30 blur-3xl"
      />

      <div className="relative max-w-sm mx-auto w-full px-5 sm:px-8 py-8 space-y-6">
        <Link href="/login" className="text-sm text-ink/50 hover:text-ink">
          ← Back to log in
        </Link>

        <div className="rounded-3xl bg-cream-deep border border-ink/10 p-6 sm:p-8 shadow-[0_20px_48px_-24px_rgba(43,43,43,0.35)] space-y-6">
          <div className="space-y-1">
            <h1 className="font-display text-3xl text-ink">Reset password</h1>
            <p className="text-sm text-ink/50">
              Enter your email and we&apos;ll send you a link to set a new
              password.
            </p>
          </div>
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
