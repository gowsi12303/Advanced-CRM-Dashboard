import {
  KanbanIcon,
  LayoutDashboardIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /**
   * True for views that share the search and filter query string, so a link
   * between them carries it across.
   */
  sharesListQuery: boolean;
};

// Only views that exist are listed; there are no placeholder entries.
export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    description: "An overview of your customers",
    href: "/dashboard",
    icon: LayoutDashboardIcon,
    sharesListQuery: false,
  },
  {
    title: "Customers",
    description: "Search, filter and manage customer records",
    href: "/customers",
    icon: UsersIcon,
    sharesListQuery: true,
  },
  {
    title: "Pipeline",
    description: "Move customers between lifecycle stages",
    href: "/pipeline",
    icon: KanbanIcon,
    sharesListQuery: true,
  },
];

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
