import { formatDateOnly } from "@/lib/format";

import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  EMPTY_CUSTOMER_FILTERS,
  type CustomerFilters,
  type DateFilterField,
} from "../types";

export const DATE_FILTER_FIELD_LABELS: Record<DateFilterField, string> = {
  createdAt: "Created",
  lastContactedAt: "Last contact",
};

/** The independent groups a filter set is made of; each can be cleared on its own. */
export type FilterGroup = "status" | "companies" | "date" | "email" | "phone";

/**
 * Canonical form of a filter set, so two sets that select the same customers
 * compare equal: lists are de-duplicated and ordered, text is trimmed, and the
 * date field is reset when no date is set (it has no effect then).
 */
export function normalizeFilters(filters: CustomerFilters): CustomerFilters {
  const hasDate = Boolean(filters.dateFrom || filters.dateTo);
  return {
    status: CUSTOMER_STATUSES.filter((status) => filters.status.includes(status)),
    companies: [...new Set(filters.companies)].sort((a, b) => a.localeCompare(b)),
    dateField: hasDate ? filters.dateField : EMPTY_CUSTOMER_FILTERS.dateField,
    dateFrom: filters.dateFrom || null,
    dateTo: filters.dateTo || null,
    includeNeverContacted:
      hasDate &&
      filters.dateField === "lastContactedAt" &&
      filters.includeNeverContacted,
    email: filters.email.trim(),
    phone: filters.phone.trim(),
  };
}

export function areFiltersEqual(a: CustomerFilters, b: CustomerFilters) {
  return JSON.stringify(normalizeFilters(a)) === JSON.stringify(normalizeFilters(b));
}

/** True when the range is usable: an open end is fine, a reversed range is not. */
export function isDateRangeValid(filters: CustomerFilters) {
  return !filters.dateFrom || !filters.dateTo || filters.dateFrom <= filters.dateTo;
}

/** Returns the filters with one group reset to its empty value. */
export function clearFilterGroup(
  filters: CustomerFilters,
  group: FilterGroup,
): CustomerFilters {
  switch (group) {
    case "status":
      return { ...filters, status: [] };
    case "companies":
      return { ...filters, companies: [] };
    case "date":
      return {
        ...filters,
        dateField: EMPTY_CUSTOMER_FILTERS.dateField,
        dateFrom: null,
        dateTo: null,
        includeNeverContacted: false,
      };
    case "email":
      return { ...filters, email: "" };
    case "phone":
      return { ...filters, phone: "" };
  }
}

function describeList(items: string[], noun: string) {
  return items.length <= 2 ? items.join(", ") : `${items.length} ${noun}`;
}

function describeDateRange(filters: CustomerFilters) {
  const range = describeRange(filters);
  return filters.includeNeverContacted ? `${range}, or never` : range;
}

function describeRange(filters: CustomerFilters) {
  const label = DATE_FILTER_FIELD_LABELS[filters.dateField];
  const { dateFrom, dateTo } = filters;
  if (dateFrom && dateTo) {
    return dateFrom === dateTo
      ? `${label}: ${formatDateOnly(dateFrom)}`
      : `${label}: ${formatDateOnly(dateFrom)} – ${formatDateOnly(dateTo)}`;
  }
  if (dateFrom) return `${label}: from ${formatDateOnly(dateFrom)}`;
  return `${label}: until ${formatDateOnly(dateTo ?? "")}`;
}

/** One human-readable summary per active filter group, in display order. */
export function describeActiveFilters(
  filters: CustomerFilters,
): { group: FilterGroup; label: string }[] {
  const normalized = normalizeFilters(filters);
  const active: { group: FilterGroup; label: string }[] = [];

  if (normalized.status.length > 0) {
    const labels = normalized.status.map((s) => CUSTOMER_STATUS_LABELS[s]);
    active.push({
      group: "status",
      label: `Status: ${describeList(labels, "statuses")}`,
    });
  }
  if (normalized.companies.length > 0) {
    active.push({
      group: "companies",
      label: `Company: ${describeList(normalized.companies, "companies")}`,
    });
  }
  if (normalized.dateFrom || normalized.dateTo) {
    active.push({ group: "date", label: describeDateRange(normalized) });
  }
  if (normalized.email) {
    active.push({ group: "email", label: `Email contains “${normalized.email}”` });
  }
  if (normalized.phone) {
    active.push({ group: "phone", label: `Phone contains “${normalized.phone}”` });
  }
  return active;
}
