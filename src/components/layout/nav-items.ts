import { KanbanIcon, UsersIcon, type LucideIcon } from "lucide-react";

export type NavItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Customers",
    description: "Search, filter and manage customer records",
    href: "/customers",
    icon: UsersIcon,
  },
  {
    title: "Pipeline",
    description: "Move customers between lifecycle stages",
    href: "/pipeline",
    icon: KanbanIcon,
  },
];

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
