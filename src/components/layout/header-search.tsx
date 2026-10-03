"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useHotkey } from "@/lib/use-hotkey";

/**
 * A search box for pages that have no customer list of their own. Submitting
 * opens the Customers page with the term applied, where the usual search,
 * filters and results take over.
 */
export function HeaderSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState("");

  useHotkey(
    "/",
    useCallback(() => inputRef.current?.focus(), []),
  );

  const handleSubmit: React.ComponentProps<"form">["onSubmit"] = (event) => {
    event.preventDefault();
    const query = term.trim();
    router.push(query ? `/customers?q=${encodeURIComponent(query)}` : "/customers");
  };

  return (
    <form role="search" onSubmit={handleSubmit} className="relative w-40 sm:w-64">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search customers…"
        aria-label="Search customers"
        aria-keyshortcuts="/"
        className="h-8 bg-muted/50 pr-8 pl-8 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {!term && (
        <kbd
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border bg-background px-1.5 font-mono text-[0.7rem] text-muted-foreground sm:block"
        >
          /
        </kbd>
      )}
    </form>
  );
}
