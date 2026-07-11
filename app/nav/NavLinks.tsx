"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { isActive, type NavItem } from "./items";

// Shared link list for both the desktop sidebar and the mobile drawer. Reads
// the current path to highlight the active item; onNavigate lets the drawer
// close itself when a link is tapped.
export function NavLinks({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(item.href, pathname);

        if (item.primary) {
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-full bg-ink text-cream px-4 py-2.5 text-sm font-semibold hover:bg-ink/85 transition-colors"
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors ${
              active
                ? "bg-ink/8 text-ink font-semibold"
                : "text-ink/60 hover:text-ink hover:bg-ink/5"
            }`}
          >
            <Icon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
