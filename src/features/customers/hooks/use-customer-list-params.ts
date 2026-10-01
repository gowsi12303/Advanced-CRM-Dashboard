"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { normalizeFilters } from "../lib/filters";
import {
  fromPageSearchParams,
  LIST_PARAM_NAMES,
  toPageSearchParams,
} from "../lib/list-params";
import type {
  CustomerFilters,
  CustomerListParams,
  CustomerSortField,
  SortOrder,
} from "../types";

type HistoryMode = "push" | "replace";

/**
 * List state (search, filters, sort, pagination) lives in the URL query
 * string, so views are shareable and survive reloads and back/forward.
 */
export function useCustomerListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  // Only the list's own keys, so unrelated URL state (such as which customer
  // drawer is open) doesn't produce a new `params` object and a refetch.
  const listQuery = useMemo(() => {
    const own = new URLSearchParams();
    for (const [key, value] of new URLSearchParams(query)) {
      if (LIST_PARAM_NAMES.includes(key)) own.append(key, value);
    }
    return own.toString();
  }, [query]);

  const params = useMemo(
    () => fromPageSearchParams(new URLSearchParams(listQuery)),
    [listQuery],
  );

  const update = useCallback(
    (patch: Partial<CustomerListParams>, history: HistoryMode = "push") => {
      // Replace the list's keys and leave everything else in the URL alone.
      const next = new URLSearchParams(query);
      for (const name of LIST_PARAM_NAMES) next.delete(name);
      for (const [key, value] of toPageSearchParams({ ...params, ...patch })) {
        next.append(key, value);
      }

      const nextQuery = next.toString();
      if (nextQuery === query) return;
      const href = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      router[history](href, { scroll: false });
    },
    [params, pathname, query, router],
  );

  // Anything that changes which rows match sends the user back to page 1.
  const setSearch = useCallback(
    // Replace, so typing doesn't add a history entry per search term.
    (search: string) => update({ search, page: 1 }, "replace"),
    [update],
  );

  const setFilters = useCallback(
    (filters: CustomerFilters) =>
      update({ filters: normalizeFilters(filters), page: 1 }),
    [update],
  );

  const setSort = useCallback(
    (sortBy: CustomerSortField, sortOrder: SortOrder) =>
      update({ sortBy, sortOrder, page: 1 }),
    [update],
  );

  const setPage = useCallback(
    (page: number, history: HistoryMode = "push") => update({ page }, history),
    [update],
  );

  const setPageSize = useCallback(
    (pageSize: number) => update({ pageSize, page: 1 }),
    [update],
  );

  return { params, setSearch, setFilters, setSort, setPage, setPageSize };
}
