import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

export async function AuthStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex justify-end p-3 text-sm border-b border-neutral-100">
      {user ? (
        <form action={signOut} className="flex items-center gap-3">
          <span className="text-neutral-500">{user.email}</span>
          <button className="text-neutral-500 hover:underline" type="submit">
            Sign out
          </button>
        </form>
      ) : (
        <Link href="/login" className="text-neutral-500 hover:underline">
          Log in
        </Link>
      )}
    </div>
  );
}
