export type NavItem = {
  id: "home" | "money" | "people" | "activity" | "settings";
  label: string;
  href: string;
  ariaLabel: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", label: "Home", href: "/", ariaLabel: "Go to Home" },
  { id: "money", label: "Money", href: "/money", ariaLabel: "Go to Money & Transfers" },
  { id: "people", label: "People", href: "/people", ariaLabel: "Go to People & Contacts" },
  { id: "activity", label: "Activity", href: "/activity", ariaLabel: "Go to Activity & Transactions" },
  { id: "settings", label: "Settings", href: "/settings", ariaLabel: "Go to Settings & Security" }
] as const;

export const isActiveRoute = (currentPathname: string, targetHref: string): boolean => {
  const normalizedCurrent = currentPathname.replace(/\/+$/, "") || "/";
  const normalizedTarget = targetHref.replace(/\/+$/, "") || "/";

  if (normalizedTarget === "/") {
    return normalizedCurrent === "/";
  }

  return normalizedCurrent === normalizedTarget || normalizedCurrent.startsWith(`${normalizedTarget}/`);
};
