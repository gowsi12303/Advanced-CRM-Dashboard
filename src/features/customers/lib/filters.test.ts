import { describe, expect, it } from "vitest";

import { filterCustomers } from "@/server/customer-query";
import { createSeedData } from "@/server/seed";

import {
  DEFAULT_CUSTOMER_LIST_PARAMS,
  EMPTY_CUSTOMER_FILTERS,
  type CustomerFilters,
  type CustomerListParams,
} from "../types";
import { FILTER_TEMPLATES } from "./filter-templates";
import {
  areFiltersEqual,
  clearFilterGroup,
  describeActiveFilters,
  isDateRangeValid,
  normalizeFilters,
} from "./filters";
import {
  countActiveFilters,
  fromPageSearchParams,
  parseSearchParams,
  toPageSearchParams,
  toSearchParams,
} from "./list-params";

const FULL_FILTERS: CustomerFilters = {
  status: ["lead", "active"],
  companies: ["Harbor & Finch", "Vela Software"],
  dateField: "lastContactedAt",
  dateFrom: "2026-01-01",
  dateTo: "2026-03-31",
  includeNeverContacted: true,
  email: "@vela",
  phone: "415",
};

const FULL_PARAMS: CustomerListParams = {
  search: "ann",
  filters: FULL_FILTERS,
  sortBy: "name",
  sortOrder: "asc",
  page: 3,
  pageSize: 25,
};

describe("list params serialisation", () => {
  it("round-trips every parameter through the API query string", () => {
    const parsed = parseSearchParams(toSearchParams(FULL_PARAMS));
    expect(parsed.success && parsed.data).toEqual(FULL_PARAMS);
  });

  it("round-trips every parameter through the page URL", () => {
    expect(fromPageSearchParams(toPageSearchParams(FULL_PARAMS))).toEqual(FULL_PARAMS);
  });

  it("keeps default and empty values out of the page URL", () => {
    expect(toPageSearchParams(DEFAULT_CUSTOMER_LIST_PARAMS).toString()).toBe("");
    expect(
      toPageSearchParams({
        ...DEFAULT_CUSTOMER_LIST_PARAMS,
        filters: { ...EMPTY_CUSTOMER_FILTERS, status: ["lead"], email: "  " },
      }).toString(),
    ).toBe("status=lead");
  });

  it("only includes the date field when a date is set", () => {
    const noDates = { ...EMPTY_CUSTOMER_FILTERS, dateField: "lastContactedAt" as const };
    expect(
      toPageSearchParams({ ...DEFAULT_CUSTOMER_LIST_PARAMS, filters: noDates }).toString(),
    ).toBe("");
    expect(
      toPageSearchParams({
        ...DEFAULT_CUSTOMER_LIST_PARAMS,
        filters: { ...noDates, dateTo: "2026-03-31" },
      }).toString(),
    ).toBe("dateField=lastContactedAt&to=2026-03-31");
  });

  it("only carries the never-contacted option with a last-contact range", () => {
    const url = (filters: Partial<CustomerFilters>) =>
      toPageSearchParams({
        ...DEFAULT_CUSTOMER_LIST_PARAMS,
        filters: { ...EMPTY_CUSTOMER_FILTERS, includeNeverContacted: true, ...filters },
      }).toString();

    expect(url({})).toBe("");
    expect(url({ dateField: "lastContactedAt" })).toBe("");
    expect(url({ dateField: "createdAt", dateTo: "2026-03-31" })).toBe(
      "dateField=createdAt&to=2026-03-31",
    );
    expect(url({ dateField: "lastContactedAt", dateTo: "2026-03-31" })).toBe(
      "dateField=lastContactedAt&to=2026-03-31&never=1",
    );
    expect(
      normalizeFilters({
        ...EMPTY_CUSTOMER_FILTERS,
        dateField: "createdAt",
        dateTo: "2026-03-31",
        includeNeverContacted: true,
      }).includeNeverContacted,
    ).toBe(false);
  });

  it("survives company names containing commas and ampersands", () => {
    const filters = { ...EMPTY_CUSTOMER_FILTERS, companies: ["Smith, Jones & Co", "A=B?"] };
    const url = toPageSearchParams({ ...DEFAULT_CUSTOMER_LIST_PARAMS, filters });
    expect(fromPageSearchParams(new URLSearchParams(url.toString())).filters).toEqual(filters);
  });

  it.each([
    "status=bogus",
    "from=not-a-date",
    "from=2026-05-01&to=2026-01-01",
    "page=0",
    "sortBy=nope",
  ])("falls back to defaults for an invalid page URL: %s", (query) => {
    expect(parseSearchParams(new URLSearchParams(query)).success).toBe(false);
    expect(fromPageSearchParams(new URLSearchParams(query))).toEqual(
      DEFAULT_CUSTOMER_LIST_PARAMS,
    );
  });

  it("ignores a page size the table does not offer", () => {
    expect(fromPageSearchParams(new URLSearchParams("pageSize=37")).pageSize).toBe(10);
    expect(fromPageSearchParams(new URLSearchParams("pageSize=50")).pageSize).toBe(50);
  });
});

describe("filter helpers", () => {
  it("counts active filter groups, not individual values", () => {
    expect(countActiveFilters(EMPTY_CUSTOMER_FILTERS)).toBe(0);
    expect(countActiveFilters(FULL_FILTERS)).toBe(5);
    expect(countActiveFilters({ ...EMPTY_CUSTOMER_FILTERS, dateTo: "2026-01-01" })).toBe(1);
    expect(countActiveFilters({ ...EMPTY_CUSTOMER_FILTERS, email: "   " })).toBe(0);
    expect(
      countActiveFilters({ ...EMPTY_CUSTOMER_FILTERS, dateField: "lastContactedAt" }),
    ).toBe(0);
  });

  it("treats equivalent filter sets as equal", () => {
    const reordered: CustomerFilters = {
      ...FULL_FILTERS,
      status: ["active", "lead", "lead"],
      companies: ["Vela Software", "Harbor & Finch"],
      email: " @vela ",
    };
    expect(areFiltersEqual(FULL_FILTERS, reordered)).toBe(true);
    expect(areFiltersEqual(FULL_FILTERS, { ...FULL_FILTERS, phone: "416" })).toBe(false);
    // The date field is irrelevant while no date is set.
    expect(
      areFiltersEqual(EMPTY_CUSTOMER_FILTERS, {
        ...EMPTY_CUSTOMER_FILTERS,
        dateField: "lastContactedAt",
      }),
    ).toBe(true);
  });

  it("normalises to a canonical form", () => {
    expect(
      normalizeFilters({
        ...EMPTY_CUSTOMER_FILTERS,
        status: ["churned", "lead"],
        dateField: "lastContactedAt",
        phone: " 415 ",
      }),
    ).toEqual({ ...EMPTY_CUSTOMER_FILTERS, status: ["lead", "churned"], phone: "415" });
  });

  it("validates the date range", () => {
    expect(isDateRangeValid(EMPTY_CUSTOMER_FILTERS)).toBe(true);
    expect(isDateRangeValid({ ...EMPTY_CUSTOMER_FILTERS, dateFrom: "2026-05-01" })).toBe(true);
    expect(isDateRangeValid(FULL_FILTERS)).toBe(true);
    expect(
      isDateRangeValid({ ...FULL_FILTERS, dateFrom: "2026-05-01", dateTo: "2026-01-01" }),
    ).toBe(false);
  });

  it("describes each active group", () => {
    expect(describeActiveFilters(EMPTY_CUSTOMER_FILTERS)).toEqual([]);
    expect(describeActiveFilters(FULL_FILTERS).map((item) => item.label)).toEqual([
      "Status: Lead, Active",
      "Company: Harbor & Finch, Vela Software",
      "Last contact: Jan 1, 2026 – Mar 31, 2026, or never",
      "Email contains “@vela”",
      "Phone contains “415”",
    ]);
    expect(
      describeActiveFilters({
        ...EMPTY_CUSTOMER_FILTERS,
        status: ["lead", "prospect", "active"],
        dateFrom: "2026-02-01",
      }).map((item) => item.label),
    ).toEqual(["Status: 3 statuses", "Created: from Feb 1, 2026"]);
    expect(
      describeActiveFilters({ ...EMPTY_CUSTOMER_FILTERS, dateTo: "2026-02-01" })[0].label,
    ).toBe("Created: until Feb 1, 2026");
  });

  it("clears one group without touching the others", () => {
    expect(clearFilterGroup(FULL_FILTERS, "status")).toEqual({ ...FULL_FILTERS, status: [] });
    expect(clearFilterGroup(FULL_FILTERS, "date")).toEqual({
      ...FULL_FILTERS,
      dateField: "createdAt",
      dateFrom: null,
      dateTo: null,
      includeNeverContacted: false,
    });
    const cleared = (["status", "companies", "date", "email", "phone"] as const).reduce(
      clearFilterGroup,
      FULL_FILTERS,
    );
    expect(cleared).toEqual(EMPTY_CUSTOMER_FILTERS);
  });
});

describe("filter templates", () => {
  // Templates use the local calendar, so "now" is given in local time.
  const now = new Date(2026, 5, 15, 10, 30);
  const { customers } = createSeedData(new Date("2026-06-15T00:00:00.000Z"));
  const build = (id: string) => {
    const template = FILTER_TEMPLATES.find((item) => item.id === id);
    if (!template) throw new Error(`Unknown template ${id}`);
    return template.build(now);
  };

  it("New leads (last 30 days): a rolling window, so it is never tied to the day of the month", () => {
    const filters = build("new-leads-30-days");
    expect(filters).toEqual({
      ...EMPTY_CUSTOMER_FILTERS,
      status: ["lead"],
      dateField: "createdAt",
      dateFrom: "2026-05-16",
    });
    const matches = filterCustomers(customers, "", filters);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((c) => c.status === "lead" && c.createdAt >= "2026-05-16")).toBe(true);

    // On the 1st of a month it still reaches back 30 days.
    const template = FILTER_TEMPLATES.find((item) => item.id === "new-leads-30-days");
    expect(template?.build(new Date(2026, 6, 1, 9)).dateFrom).toBe("2026-06-01");
    expect(template?.build(new Date(2026, 2, 1, 9)).dateFrom).toBe("2026-01-30");
  });

  it("No contact in 30 days: open customers contacted 30+ days ago, or never", () => {
    const filters = build("no-contact-30-days");
    expect(filters).toEqual({
      ...EMPTY_CUSTOMER_FILTERS,
      status: ["lead", "prospect", "active"],
      dateField: "lastContactedAt",
      dateTo: "2026-05-16",
      includeNeverContacted: true,
    });
    const matches = filterCustomers(customers, "", filters);
    expect(matches.some((c) => c.lastContactedAt === null)).toBe(true);
    expect(matches.some((c) => c.lastContactedAt !== null)).toBe(true);
    expect(
      matches.every(
        (c) => c.lastContactedAt === null || c.lastContactedAt.slice(0, 10) <= "2026-05-16",
      ),
    ).toBe(true);
    // Every never-contacted open customer is included.
    const neverContacted = customers.filter(
      (c) => c.lastContactedAt === null && filters.status.includes(c.status),
    );
    expect(neverContacted.length).toBeGreaterThan(0);
    expect(neverContacted.every((c) => matches.includes(c))).toBe(true);
  });

  it("Churn risk: active customers contacted 90+ days ago, or never", () => {
    const filters = build("churn-risk");
    expect(filters).toEqual({
      ...EMPTY_CUSTOMER_FILTERS,
      status: ["active"],
      dateField: "lastContactedAt",
      dateTo: "2026-03-17",
      includeNeverContacted: true,
    });
    const matches = filterCustomers(customers, "", filters);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((c) => c.status === "active")).toBe(true);
  });

  it("every template passes validation and counts as active", () => {
    for (const template of FILTER_TEMPLATES) {
      const filters = template.build(now);
      expect(isDateRangeValid(filters)).toBe(true);
      expect(countActiveFilters(filters)).toBeGreaterThan(0);
      expect(normalizeFilters(filters)).toEqual(filters);
    }
  });
});
