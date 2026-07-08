import Link from "next/link";
import { NewSongForm } from "./NewSongForm";

export default function NewSongPage() {
  return (
    <main className="min-h-screen p-8 max-w-lg mx-auto space-y-6">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">New song</h1>
      <NewSongForm />
    </main>
  );
}
