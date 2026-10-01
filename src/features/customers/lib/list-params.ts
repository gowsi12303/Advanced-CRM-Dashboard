import { z } from "zod";

import {
  CUSTOMER_SORT_FIELDS,
  DEFAULT_CUSTOMER_LIST_PARAMS,
  EMPTY_CUSTOMER_FILTERS,
  MAX_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  SORT_ORDERS,
  type CustomerFilters,
  type CustomerListParams,
} from "../types";
import { customerFiltersSchema } from "./schemas";

// The wire format of the customer list query string. The client serialises
// with `toSearchParams` and the server reads it back with `parseSearchParams`,
// so the two can't drift apart.

const PARAM = {
  search: "q",
  status: "status",
  company: "company",
  dateField: "dateField",
  dateFrom: "from",
  dateTo: "to",
  includeNeverContacted: "never",
  email: "email",
  phone: "phone",
  sortBy: "sortBy",
  sortOrder: "sortOrder",
  page: "page",
  pageSize: "pageSize",
} as const;

export function filtersToSearchParams(
  filters: CustomerFilters,
  target = new URLSearchParams(),
): URLSearchParams {
  // Repeated keys rather than a comma list: company names may contain commas.
  filters.status.forEach((status) => target.append(PARAM.status, status));
  filters.companies.forEach((company) => target.append(PARAM.company, company));
  if (filters.dateFrom || filters.dateTo) {
    target.set(PARAM.dateField, filters.dateField);
    if (filters.dateFrom) target.set(PARAM.dateFrom, filters.dateFrom);
    if (filters.dateTo) target.set(PARAM.dateTo, filters.dateTo);
    if (filters.dateField === "lastContactedAt" && filters.includeNeverContacted) {
      target.set(PARAM.includeNeverContacted, "1");
    }
  }
  if (filters.email.trim()) target.set(PARAM.email, filters.email.trim());
  if (filters.phone.trim()) target.set(PARAM.phone, filters.phone.trim());
  return target;
}

export function toSearchParams(params: CustomerListParams): URLSearchParams {
  const target = new URLSearchParams();
  if (params.search.trim()) target.set(PARAM.search, params.search.trim());
  filtersToSearchParams(params.filters, target);
  target.set(PARAM.sortBy, params.sortBy);
  target.set(PARAM.sortOrder, params.sortOrder);
  target.set(PARAM.page, String(params.page));
  target.set(PARAM.pageSize, String(params.pageSize));
  return target;
}

const listParamsSchema = z.object({
  search: z.string().trim().max(120),
  filters: customerFiltersSchema,
  sortBy: z.enum(CUSTOMER_SORT_FIELDS),
  sortOrder: z.enum(SORT_ORDERS),
  page: z.coerce.number().int().min(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE),
});

/** Every query-string key that belongs to the list state. */
export const LIST_PARAM_NAMES: readonly string[] = Object.values(PARAM);

/** Parses and validates a list query string. Missing params fall back to defaults. */
export function parseSearchParams(source: URLSearchParams) {
  const defaults = DEFAULT_CUSTOMER_LIST_PARAMS;
  return listParamsSchema.safeParse({
    search: source.get(PARAM.search) ?? defaults.search,
    filters: {
      status: source.getAll(PARAM.status),
      companies: source.getAll(PARAM.company),
      dateField: source.get(PARAM.dateField) ?? EMPTY_CUSTOMER_FILTERS.dateField,
      dateFrom: source.get(PARAM.dateFrom),
      dateTo: source.get(PARAM.dateTo),
      includeNeverContacted: source.get(PARAM.includeNeverContacted) === "1",
      email: source.get(PARAM.email) ?? "",
      phone: source.get(PARAM.phone) ?? "",
    },
    sortBy: source.get(PARAM.sortBy) ?? defaults.sortBy,
    sortOrder: source.get(PARAM.sortOrder) ?? defaults.sortOrder,
    page: source.get(PARAM.page) ?? defaults.page,
    pageSize: source.get(PARAM.pageSize) ?? defaults.pageSize,
  });
}

/**
 * The page URL uses the same param names as the API, but leaves defaults out
 * so a plain `/customers` stays clean and shared links stay short.
 */
export function toPageSearchParams(params: CustomerListParams): URLSearchParams {
  const defaults = DEFAULT_CUSTOMER_LIST_PARAMS;
  const target = toSearchParams(params);
  const isDefaultSort =
    params.sortBy === defaults.sortBy && params.sortOrder === defaults.sortOrder;
  if (isDefaultSort) {
    target.delete(PARAM.sortBy);
    target.delete(PARAM.sortOrder);
  }
  if (params.page === defaults.page) target.delete(PARAM.page);
  if (params.pageSize === defaults.pageSize) target.delete(PARAM.pageSize);
  return target;
}

/** Reads list state from the page URL; a hand-edited, invalid URL falls back to defaults. */
export function fromPageSearchParams(source: URLSearchParams): CustomerListParams {
  const parsed = parseSearchParams(source);
  if (!parsed.success) return DEFAULT_CUSTOMER_LIST_PARAMS;
  const isOfferedPageSize = PAGE_SIZE_OPTIONS.some(
    (size) => size === parsed.data.pageSize,
  );
  return isOfferedPageSize
    ? parsed.data
    : { ...parsed.data, pageSize: DEFAULT_CUSTOMER_LIST_PARAMS.pageSize };
}

/** Number of filter groups that are currently narrowing the list. */
export function countActiveFilters(filters: CustomerFilters): number {
  return [
    filters.status.length > 0,
    filters.companies.length > 0,
    Boolean(filters.dateFrom || filters.dateTo),
    filters.email.trim().length > 0,
    filters.phone.trim().length > 0,
  ].filter(Boolean).length;
}
