"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { NavLinks } from "./NavLinks";
import type { NavItem } from "./items";
import { signOut } from "../login/actions";

// Below `lg`, the sidebar collapses to this: a sticky top bar with a
// hamburger that opens a slide-in drawer holding the same nav items.
export function MobileNav({
  items,
  email,
}: {
  items: NavItem[];
  email: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes (a link was followed).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll + allow Esc to close while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <div className="sticky top-0 z-30 flex items-center justify-between bg-cream/90 backdrop-blur border-b border-ink/10 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="rounded-lg p-1.5 text-ink/70 hover:bg-ink/5 transition-colors"
        >
          <Icon name="menu" className="h-6 w-6" />
        </button>
        <Link href="/" className="font-display text-sm text-ink/80">
          Lyric Clip Generator
        </Link>
        <Link
          href="/account"
          aria-label="Account"
          className="rounded-lg p-1.5 text-ink/70 hover:bg-ink/5 transition-colors"
        >
          <Icon name="user" />
        </Link>
      </div>

      {open && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] bg-cream-deep border-r border-ink/10 p-5 flex flex-col gap-5 shadow-[0_20px_48px_-24px_rgba(43,43,43,0.5)]">
            <div className="flex items-center justify-between">
              <span className="font-display text-lg text-ink">Lyric Clip</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-ink/60 hover:bg-ink/5 transition-colors"
              >
                <Icon name="close" />
              </button>
            </div>

            <NavLinks items={items} onNavigate={() => setOpen(false)} />

            <div className="mt-auto border-t border-ink/10 pt-4 space-y-2">
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-ink/60 hover:text-ink hover:bg-ink/5 transition-colors"
              >
                <Icon name="user" />
                Account
              </Link>
              {email && (
                <p className="px-4 text-xs text-ink/40 truncate">{email}</p>
              )}
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
          </div>
        </div>
      )}
    </div>
  );
}
