"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * A single query-string parameter as state. Other parameters are left alone,
 * and each change is a history entry, so Back undoes it.
 */
export function useUrlParam(name: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const value = searchParams.get(name);

  const setValue = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(query);
      if (next === null) params.delete(name);
      else params.set(name, next);

      const nextQuery = params.toString();
      if (nextQuery === query) return;
      router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    },
    [name, pathname, query, router],
  );

  return [value, setValue] as const;
}
