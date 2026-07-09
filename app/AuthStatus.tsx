import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

export async function AuthStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex justify-end p-3 text-sm">
      {user ? (
        <form action={signOut} className="flex items-center gap-3">
          <span className="text-ink/50">{user.email}</span>
          <button
            className="rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/70 hover:bg-ink/5 transition-colors"
            type="submit"
          >
            Sign out
          </button>
        </form>
      ) : (
        <Link
          href="/login"
          className="rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/70 hover:bg-ink/5 transition-colors"
        >
          Log in
        </Link>
      )}
    </div>
  );
}
