import { describe, expect, it } from "vitest";

import {
  CUSTOMER_STATUSES,
  DEFAULT_CUSTOMER_LIST_PARAMS,
  EMPTY_CUSTOMER_FILTERS,
  type CustomerFilters,
  type CustomerListParams,
} from "@/features/customers/types";

import {
  calendarDay,
  filterCustomers,
  isValidTimeZone,
  queryCustomers,
} from "./customer-query";
import { createSeedData } from "./seed";

const ANCHOR = new Date("2026-06-15T00:00:00.000Z");
const { customers } = createSeedData(ANCHOR);

const digits = (value: string) => value.replace(/\D/g, "");
const day = (iso: string) => iso.slice(0, 10);

function filtered(filters: Partial<CustomerFilters>, search = "") {
  const result = filterCustomers(customers, search, {
    ...EMPTY_CUSTOMER_FILTERS,
    ...filters,
  });
  // Every assertion below is about a non-trivial subset.
  expect(result.length).toBeGreaterThan(0);
  expect(result.length).toBeLessThan(customers.length);
  return result;
}

function query(params: Partial<CustomerListParams>) {
  return queryCustomers(customers, { ...DEFAULT_CUSTOMER_LIST_PARAMS, ...params });
}

describe("seed data", () => {
  it("is deterministic", () => {
    expect(createSeedData(ANCHOR).customers).toEqual(customers);
    expect(customers).toHaveLength(150);
    expect(new Set(customers.map((c) => c.email)).size).toBe(150);
  });
});

describe("filterCustomers", () => {
  it("returns everything when no filter is set", () => {
    expect(filterCustomers(customers, "", EMPTY_CUSTOMER_FILTERS)).toHaveLength(150);
  });

  it.each(CUSTOMER_STATUSES)("filters by status %s", (status) => {
    const result = filtered({ status: [status] });
    expect(result.every((c) => c.status === status)).toBe(true);
  });

  it("filters by several statuses", () => {
    const result = filtered({ status: ["lead", "churned"] });
    expect(new Set(result.map((c) => c.status))).toEqual(new Set(["lead", "churned"]));
  });

  it("filters by one company, including names with punctuation", () => {
    const result = filtered({ companies: ["Harbor & Finch"] });
    expect(result.every((c) => c.company === "Harbor & Finch")).toBe(true);
  });

  it("filters by several companies", () => {
    const one = filtered({ companies: ["Vela Software"] });
    const two = filtered({ companies: ["Vela Software", "Atlas Freight"] });
    expect(two.length).toBeGreaterThan(one.length);
    expect(
      two.every((c) => ["Vela Software", "Atlas Freight"].includes(c.company)),
    ).toBe(true);
  });

  it("filters by a created-date range, inclusive at both ends", () => {
    const target = day(customers[7].createdAt);
    const sameDay = filtered({ dateField: "createdAt", dateFrom: target, dateTo: target });
    expect(sameDay.map((c) => c.id)).toContain(customers[7].id);
    expect(sameDay.every((c) => day(c.createdAt) === target)).toBe(true);

    const range = filtered({
      dateField: "createdAt",
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31",
    });
    expect(
      range.every((c) => day(c.createdAt) >= "2026-01-01" && day(c.createdAt) <= "2026-03-31"),
    ).toBe(true);
  });

  it("accepts an open-ended range in either direction", () => {
    const from = filtered({ dateField: "createdAt", dateFrom: "2026-01-01" });
    expect(from.every((c) => day(c.createdAt) >= "2026-01-01")).toBe(true);

    const to = filtered({ dateField: "createdAt", dateTo: "2025-12-31" });
    expect(to.every((c) => day(c.createdAt) <= "2025-12-31")).toBe(true);
    expect(from.length + to.length).toBe(150);
  });

  it("filters by last-contact date and leaves out never-contacted customers", () => {
    expect(customers.some((c) => c.lastContactedAt === null)).toBe(true);
    const result = filtered({ dateField: "lastContactedAt", dateTo: "2026-05-15" });
    expect(
      result.every((c) => c.lastContactedAt !== null && day(c.lastContactedAt) <= "2026-05-15"),
    ).toBe(true);
  });

  it("can include never-contacted customers in a last-contact range", () => {
    const range = { dateField: "lastContactedAt" as const, dateTo: "2026-05-15" };
    const without = filtered(range);
    const withNever = filtered({ ...range, includeNeverContacted: true });
    const never = customers.filter((c) => c.lastContactedAt === null);

    expect(withNever).toHaveLength(without.length + never.length);
    expect(never.every((c) => withNever.includes(c))).toBe(true);
    // The option means nothing for the created date, which every customer has.
    expect(
      filtered({ dateField: "createdAt", dateTo: "2025-12-31", includeNeverContacted: true }),
    ).toEqual(filtered({ dateField: "createdAt", dateTo: "2025-12-31" }));
  });

  it("matches part of an email, ignoring case", () => {
    const result = filtered({ email: "  @VELA. " });
    expect(result.every((c) => c.email.includes("@vela."))).toBe(true);
  });

  it("matches part of a phone number, ignoring formatting", () => {
    const plain = filtered({ phone: "415555" });
    expect(plain.every((c) => digits(c.phone).includes("415555"))).toBe(true);
    expect(filtered({ phone: "(415) 555" })).toEqual(plain);
    expect(filtered({ phone: "415-555" })).toEqual(plain);
  });

  it("combines filters with AND", () => {
    const filters: Partial<CustomerFilters> = {
      status: ["active", "prospect"],
      companies: ["Vela Software", "Quartz Financial", "Harbor & Finch"],
      dateField: "createdAt",
      dateFrom: "2025-01-01",
      email: ".example",
    };
    const result = filtered(filters);
    expect(
      result.every(
        (c) =>
          ["active", "prospect"].includes(c.status) &&
          filters.companies?.includes(c.company) &&
          day(c.createdAt) >= "2025-01-01",
      ),
    ).toBe(true);
    // Each extra filter can only narrow the result.
    expect(result.length).toBeLessThanOrEqual(filtered({ status: filters.status }).length);
    expect(result.length).toBeLessThanOrEqual(
      filtered({ companies: filters.companies }).length,
    );
  });

  it("combines search with filters", () => {
    const filters = { status: ["active" as const] };
    const result = filtered(filters, "quartz");
    expect(result.length).toBeLessThan(filtered(filters).length);
    expect(
      result.every((c) => c.status === "active" && c.company === "Quartz Financial"),
    ).toBe(true);
  });

  it("returns nothing when filters contradict each other", () => {
    const result = filterCustomers(customers, "", {
      ...EMPTY_CUSTOMER_FILTERS,
      companies: ["Vela Software"],
      email: "@quartzfinancial",
    });
    expect(result).toEqual([]);
  });
});

describe("queryCustomers", () => {
  it("applies filters, then sorting, then pagination", () => {
    const filters = { ...EMPTY_CUSTOMER_FILTERS, status: ["active" as const] };
    const all = query({ filters, sortBy: "name", sortOrder: "asc", pageSize: 500 });
    const page2 = query({ filters, sortBy: "name", sortOrder: "asc", page: 2, pageSize: 10 });

    expect(page2.total).toBe(all.total);
    expect(page2.items).toEqual(all.items.slice(10, 20));
    expect(page2.totalPages).toBe(Math.ceil(all.total / 10));
  });

  it("clamps a page past the end to the last page", () => {
    const result = query({ page: 99, pageSize: 50 });
    expect(result.page).toBe(3);
    expect(result.items).toHaveLength(50);
  });

  it("reports one empty page when nothing matches", () => {
    const result = query({ search: "zzzz-no-match" });
    expect(result).toMatchObject({ items: [], total: 0, page: 1, totalPages: 1 });
  });

  it("sorts never-contacted customers last in both directions", () => {
    for (const sortOrder of ["asc", "desc"] as const) {
      const items = query({ sortBy: "lastContactedAt", sortOrder, pageSize: 500 }).items;
      const firstNull = items.findIndex((c) => c.lastContactedAt === null);
      expect(firstNull).toBeGreaterThan(0);
      expect(items.slice(firstNull).every((c) => c.lastContactedAt === null)).toBe(true);
    }
  });
});

describe("time zones", () => {
  it("finds the calendar day of an instant in a time zone", () => {
    const instant = "2026-03-10T20:30:00.000Z";
    expect(calendarDay(instant, "UTC")).toBe("2026-03-10");
    expect(calendarDay(instant, "Asia/Kolkata")).toBe("2026-03-11");
    expect(calendarDay(instant, "America/Los_Angeles")).toBe("2026-03-10");
    expect(calendarDay("2026-03-10T03:00:00.000Z", "America/Los_Angeles")).toBe("2026-03-09");
  });

  it("recognises valid and invalid zone names", () => {
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
  });

  it("applies date filters to the viewer's calendar day", () => {
    // 20:30 UTC on the 10th is already the 11th in India.
    const late = { ...customers[0], id: "late", createdAt: "2026-03-10T20:30:00.000Z" };
    const onThe = (day: string, timeZone?: string) =>
      filterCustomers(
        [late],
        "",
        { ...EMPTY_CUSTOMER_FILTERS, dateField: "createdAt", dateFrom: day, dateTo: day },
        timeZone,
      ).length;

    expect(onThe("2026-03-10")).toBe(1);
    expect(onThe("2026-03-11")).toBe(0);
    expect(onThe("2026-03-10", "Asia/Kolkata")).toBe(0);
    expect(onThe("2026-03-11", "Asia/Kolkata")).toBe(1);
    expect(onThe("2026-03-10", "America/Los_Angeles")).toBe(1);
  });

  it("passes the zone through queryCustomers", () => {
    const filters = {
      ...EMPTY_CUSTOMER_FILTERS,
      dateField: "createdAt" as const,
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31",
    };
    const utc = queryCustomers(customers, { ...DEFAULT_CUSTOMER_LIST_PARAMS, filters, pageSize: 500 });
    const tokyo = queryCustomers(
      customers,
      { ...DEFAULT_CUSTOMER_LIST_PARAMS, filters, pageSize: 500 },
      "Asia/Tokyo",
    );
    expect(utc.total).toBeGreaterThan(0);
    expect(
      tokyo.items.every((c) => {
        const day = calendarDay(c.createdAt, "Asia/Tokyo");
        return day >= "2026-01-01" && day <= "2026-03-31";
      }),
    ).toBe(true);
  });
});
