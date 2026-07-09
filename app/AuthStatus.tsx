import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

export async function AuthStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className="flex items-center justify-between p-3 text-sm">
      <Link href="/" className="font-display text-sm text-ink/70 hover:text-ink">
        Lyric Clip Generator
      </Link>

      <div className="flex items-center gap-4">
        <Link href="/pricing" className="text-ink/50 hover:text-ink">
          Pricing
        </Link>
        <Link href="/faq" className="text-ink/50 hover:text-ink">
          FAQ
        </Link>
        {user ? (
          <>
            <Link href="/account" className="text-ink/50 hover:text-ink">
              Account
            </Link>
            <form action={signOut}>
              <button
                className="rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/70 hover:bg-ink/5 transition-colors"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/70 hover:bg-ink/5 transition-colors"
          >
            Log in
          </Link>
        )}
      </div>
    </nav>
  );
}
