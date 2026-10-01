import {
  CUSTOMER_STATUSES,
  type Customer,
  type CustomerFilters,
  type CustomerListParams,
  type CustomerSortField,
  type Paginated,
} from "@/features/customers/types";

// Pure search / filter / sort / paginate logic for the customer list.
// Kept free of store and HTTP concerns so it can be unit tested directly.

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar day (`yyyy-MM-dd`) an instant falls on in the given time zone. */
export function calendarDay(iso: string, timeZone: string): string {
  // ISO timestamps start with the UTC calendar date.
  if (timeZone === "UTC") return iso.slice(0, 10);
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    // The en-CA locale formats dates as yyyy-MM-dd.
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(timeZone, formatter);
  }
  return formatter.format(new Date(iso));
}

function digitsOf(value: string) {
  return value.replace(/\D/g, "");
}

/** Phone matching ignores formatting, so "415555" matches "+1 (415) 555-0199". */
function matchesPhone(phone: string, query: string) {
  const queryDigits = digitsOf(query);
  if (queryDigits) return digitsOf(phone).includes(queryDigits);
  return phone.toLowerCase().includes(query.toLowerCase());
}

function matchesSearch(customer: Customer, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  if (
    customer.name.toLowerCase().includes(term) ||
    customer.email.toLowerCase().includes(term) ||
    customer.company.toLowerCase().includes(term) ||
    customer.phone.toLowerCase().includes(term)
  ) {
    return true;
  }
  // Only treat the term as a phone number when it has no letters, otherwise
  // "level 4" would match every phone containing a 4.
  const isPhoneLike = !/[a-z]/.test(term) && digitsOf(term).length > 0;
  return isPhoneLike && digitsOf(customer.phone).includes(digitsOf(term));
}

function matchesFilters(
  customer: Customer,
  filters: CustomerFilters,
  timeZone: string,
) {
  if (filters.status.length > 0 && !filters.status.includes(customer.status)) {
    return false;
  }
  if (
    filters.companies.length > 0 &&
    !filters.companies.includes(customer.company)
  ) {
    return false;
  }

  const email = filters.email.trim().toLowerCase();
  if (email && !customer.email.toLowerCase().includes(email)) return false;

  const phone = filters.phone.trim();
  if (phone && !matchesPhone(customer.phone, phone)) return false;

  if (filters.dateFrom || filters.dateTo) {
    const value = customer[filters.dateField];
    // A customer without the date (never contacted) can't fall inside a range;
    // they match only when the filter explicitly asks for them.
    if (!value) {
      return (
        filters.dateField === "lastContactedAt" && filters.includeNeverContacted
      );
    }
    // Compared as calendar days in the viewer's time zone, so the filter agrees
    // with the dates they see. yyyy-MM-dd strings sort lexically.
    const day = calendarDay(value, timeZone);
    if (filters.dateFrom && day < filters.dateFrom) return false;
    if (filters.dateTo && day > filters.dateTo) return false;
  }

  return true;
}

function compareBy(field: CustomerSortField, a: Customer, b: Customer) {
  switch (field) {
    case "name":
    case "company":
    case "email":
      return collator.compare(a[field], b[field]);
    case "status":
      return (
        CUSTOMER_STATUSES.indexOf(a.status) - CUSTOMER_STATUSES.indexOf(b.status)
      );
    case "pipelineRank":
      return a.pipelineRank - b.pipelineRank;
    case "createdAt":
      return a.createdAt.localeCompare(b.createdAt);
    case "lastContactedAt":
      return (a.lastContactedAt ?? "").localeCompare(b.lastContactedAt ?? "");
  }
}

export function filterCustomers(
  customers: readonly Customer[],
  search: string,
  filters: CustomerFilters,
  timeZone = "UTC",
): Customer[] {
  return customers.filter(
    (customer) =>
      matchesSearch(customer, search) &&
      matchesFilters(customer, filters, timeZone),
  );
}

export function sortCustomers(
  customers: readonly Customer[],
  sortBy: CustomerSortField,
  sortOrder: CustomerListParams["sortOrder"],
): Customer[] {
  const direction = sortOrder === "asc" ? 1 : -1;
  return [...customers].sort((a, b) => {
    // Never-contacted customers go last in either direction.
    if (sortBy === "lastContactedAt") {
      if (!a.lastContactedAt && b.lastContactedAt) return 1;
      if (a.lastContactedAt && !b.lastContactedAt) return -1;
    }
    const result = compareBy(sortBy, a, b) * direction;
    // Stable, deterministic order for equal values so pages never overlap.
    return result !== 0 ? result : a.id.localeCompare(b.id);
  });
}

export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): Paginated<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Clamp instead of returning an empty page, e.g. after deleting the last
  // row of the final page.
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: currentPage,
    pageSize,
    totalPages,
  };
}

export function queryCustomers(
  customers: readonly Customer[],
  params: CustomerListParams,
  timeZone = "UTC",
): Paginated<Customer> {
  const filtered = filterCustomers(
    customers,
    params.search,
    params.filters,
    timeZone,
  );
  const sorted = sortCustomers(filtered, params.sortBy, params.sortOrder);
  return paginate(sorted, params.page, params.pageSize);
}
