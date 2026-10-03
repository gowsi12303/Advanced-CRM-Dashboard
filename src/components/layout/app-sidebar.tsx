"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { RadioTowerIcon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

import { findNavItem, NAV_ITEMS } from "./nav-items";

/**
 * The workspace links. Search and filters live in the query string and apply
 * to both the table and the board, so the links carry the current query
 * across; switching views keeps what you were looking at.
 */
function NavLinks({ query }: { query: string }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const active = findNavItem(pathname);
  const activeHref = active?.href;
  // The query only means something to the list views, and only when coming
  // from one of them.
  const sharedQuery = active?.sharesListQuery ? query : "";

  return (
    <SidebarMenu>
      {NAV_ITEMS.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={item.href === activeHref}
            tooltip={item.title}
            className="h-9 text-sidebar-foreground/85 data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-accent-foreground data-[active=true]:[&>svg]:text-sidebar-ring"
          >
            {/* Close the mobile drawer after navigating. */}
            <Link
              href={
                item.sharesListQuery && sharedQuery
                  ? `${item.href}?${sharedQuery}`
                  : item.href
              }
              aria-current={item.href === activeHref ? "page" : undefined}
              onClick={() => setOpenMobile(false)}
            >
              <item.icon />
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function NavLinksWithQuery() {
  return <NavLinks query={useSearchParams().toString()} />;
}

export function AppSidebar() {
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard" onClick={() => setOpenMobile(false)}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-sidebar-primary/40">
                  <RadioTowerIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Relay CRM</span>
                  <span className="truncate text-xs text-sidebar-foreground/85">
                    Customer workspace
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/85">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {/* The query string is only known in the browser; until then the
                links render without it rather than holding up the sidebar. */}
            <Suspense fallback={<NavLinks query="" />}>
              <NavLinksWithQuery />
            </Suspense>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
