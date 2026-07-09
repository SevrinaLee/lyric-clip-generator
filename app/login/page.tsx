import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <main className="min-h-screen p-8 max-w-sm mx-auto space-y-6 flex flex-col justify-center">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">
        Lyric Clip Generator
      </h1>
      <LoginForm redirectTo={redirect ?? "/"} />
    </main>
  );
}
