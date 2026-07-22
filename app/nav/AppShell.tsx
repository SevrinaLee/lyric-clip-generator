import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";
import { Icon } from "./icons";
import { NavLinks } from "./NavLinks";
import { MobileNav } from "./MobileNav";
import { primaryItems } from "./items";

// The app's navigation shell. Signed-in users get an app-shell: a fixed left
// sidebar on desktop, collapsing to a hamburger drawer below `lg`. Signed-out
// visitors get the lighter marketing top bar so the landing stays airy.
export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <nav className="flex items-center justify-between p-3 text-sm">
          <Link
            href="/"
            className="font-display text-sm text-ink/70 hover:text-ink"
          >
            Lyric Clip Generator
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/showcase" className="text-ink/50 hover:text-ink">
              Showcase
            </Link>
            <Link href="/pricing" className="text-ink/50 hover:text-ink">
              Pricing
            </Link>
            <Link href="/support" className="text-ink/50 hover:text-ink">
              Support
            </Link>
            <Link href="/faq" className="text-ink/50 hover:text-ink">
              FAQ
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/70 hover:bg-ink/5 transition-colors"
            >
              Log in
            </Link>
          </div>
        </nav>
        {children}
        <footer className="mt-auto border-t border-ink/10 px-4 py-6">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-ink/40">
            <span>© {new Date().getFullYear()} Lyric Clip Generator</span>
            <Link href="/pricing" className="hover:text-ink">Pricing</Link>
            <Link href="/support" className="hover:text-ink">Support</Link>
            <Link href="/faq" className="hover:text-ink">FAQ</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
          </div>
        </footer>
      </>
    );
  }

  return (
    <>
      <aside className="hidden lg:flex fixed left-0 top-0 z-30 h-screen w-60 flex-col gap-6 border-r border-ink/10 bg-cream-deep px-4 py-6">
        <Link href="/" className="px-2 font-display text-lg text-ink">
          Lyric Clip
        </Link>

        <NavLinks items={primaryItems} />

        <div className="mt-auto border-t border-ink/10 pt-4 space-y-1">
          <Link
            href="/account"
            className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-ink/60 hover:text-ink hover:bg-ink/5 transition-colors"
          >
            <Icon name="user" />
            Account
          </Link>
          <p className="px-4 text-xs text-ink/40 truncate">{user.email}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-ink/60 hover:text-ink hover:bg-ink/5 transition-colors"
            >
              <Icon name="logout" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-60">
        <MobileNav items={primaryItems} email={user.email ?? null} />
        {children}
      </div>
    </>
  );
}
