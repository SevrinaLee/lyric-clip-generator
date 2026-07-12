import type { IconName } from "./icons";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  primary?: boolean;
};

// Primary destinations for a signed-in user, in sidebar order.
export const primaryItems: NavItem[] = [
  { href: "/songs/new", label: "New song", icon: "plus", primary: true },
  { href: "/songs", label: "My songs", icon: "music" },
  { href: "/clips", label: "My clips", icon: "film" },
  { href: "/pricing", label: "Pricing", icon: "tag" },
  { href: "/faq", label: "FAQ", icon: "help" },
];

// Whether a nav item should read as "active" for the current path. My songs
// covers the song editor (/songs/:id) but not the New song page.
export function isActive(href: string, pathname: string): boolean {
  if (href === "/songs/new") return pathname === "/songs/new";
  if (href === "/songs") {
    return (
      pathname === "/songs" ||
      (pathname.startsWith("/songs/") && pathname !== "/songs/new")
    );
  }
  return pathname === href;
}
