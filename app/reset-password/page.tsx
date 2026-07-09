import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The reset email's link lands on /auth/callback first, which exchanges
  // the recovery code for a session — so by the time this page loads, a
  // valid link means the user is signed in. No session means the link was
  // expired, already used, or the page was opened directly.
  if (!user) redirect("/forgot-password");

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

      <div className="relative max-w-sm mx-auto w-full px-8 py-8 space-y-6">
        <div className="rounded-3xl bg-cream-deep border border-ink/10 p-8 shadow-[0_20px_48px_-24px_rgba(43,43,43,0.35)] space-y-6">
          <div className="space-y-1">
            <h1 className="font-display text-3xl text-ink">
              Choose a new password
            </h1>
            <p className="text-sm text-ink/50">for {user.email}</p>
          </div>
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
