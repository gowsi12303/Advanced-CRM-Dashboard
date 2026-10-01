"use client";

import { usePathname } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

import { findNavItem } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  const pathname = usePathname();
  const current = findNavItem(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 !h-4" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold">
          {current?.title ?? "Relay CRM"}
        </h1>
        {current && (
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {current.description}
          </p>
        )}
      </div>
      <ThemeToggle />
    </header>
  );
}
