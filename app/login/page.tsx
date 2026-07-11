import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

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
        <Link href="/" className="text-sm text-ink/50 hover:text-ink">
          ← Back
        </Link>

        <div className="rounded-3xl bg-cream-deep border border-ink/10 p-6 sm:p-8 shadow-[0_20px_48px_-24px_rgba(43,43,43,0.35)] space-y-6">
          <h1 className="font-display text-3xl text-ink">
            Lyric Clip Generator
          </h1>
          <LoginForm redirectTo={redirect ?? "/"} />
        </div>
      </div>
    </main>
  );
}
