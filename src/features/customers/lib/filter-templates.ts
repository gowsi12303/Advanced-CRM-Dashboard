import { toLocalDateOnly } from "@/lib/format";

import { EMPTY_CUSTOMER_FILTERS, type CustomerFilters } from "../types";

// Templates use the viewer's local calendar, the same one the API uses when
// it applies a date filter.
function daysAgo(now: Date, days: number) {
  return toLocalDateOnly(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - days),
  );
}

export type FilterTemplate = {
  id: string;
  name: string;
  description: string;
  /** Builds the filter set relative to `now`, since templates use rolling dates. */
  build: (now: Date) => CustomerFilters;
};

export const FILTER_TEMPLATES: FilterTemplate[] = [
  {
    // A rolling window rather than "this calendar month", which would be
    // empty or nearly empty for the first days of every month.
    id: "new-leads-30-days",
    name: "New leads (last 30 days)",
    description: "Leads created in the last 30 days",
    build: (now) => ({
      ...EMPTY_CUSTOMER_FILTERS,
      status: ["lead"],
      dateField: "createdAt",
      dateFrom: daysAgo(now, 30),
    }),
  },
  {
    id: "no-contact-30-days",
    name: "No contact in 30 days",
    description:
      "Leads, prospects and active customers not contacted in the last 30 days, or never",
    build: (now) => ({
      ...EMPTY_CUSTOMER_FILTERS,
      status: ["lead", "prospect", "active"],
      dateField: "lastContactedAt",
      dateTo: daysAgo(now, 30),
      includeNeverContacted: true,
    }),
  },
  {
    id: "churn-risk",
    name: "Churn risk",
    description: "Active customers not contacted in the last 90 days, or never",
    build: (now) => ({
      ...EMPTY_CUSTOMER_FILTERS,
      status: ["active"],
      dateField: "lastContactedAt",
      dateTo: daysAgo(now, 90),
      includeNeverContacted: true,
    }),
  },
];
