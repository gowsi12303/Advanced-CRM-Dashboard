import type { CustomerSortField, SortOrder } from "../types";

/** Fields the customer table can be sorted by, with their display labels. */
export const TABLE_SORT_FIELDS = [
  { field: "name", label: "Name" },
  { field: "email", label: "Email" },
  { field: "company", label: "Company" },
  { field: "status", label: "Status" },
  { field: "lastContactedAt", label: "Last contact" },
  { field: "createdAt", label: "Created" },
] as const satisfies readonly { field: CustomerSortField; label: string }[];

/** Dates read most naturally newest-first; text reads A to Z. */
function initialOrder(field: CustomerSortField): SortOrder {
  return field === "createdAt" || field === "lastContactedAt" ? "desc" : "asc";
}

/** The sort that results from activating a column: flip it if already active. */
export function nextSort(
  current: { sortBy: CustomerSortField; sortOrder: SortOrder },
  field: CustomerSortField,
): { sortBy: CustomerSortField; sortOrder: SortOrder } {
  if (current.sortBy !== field) {
    return { sortBy: field, sortOrder: initialOrder(field) };
  }
  return { sortBy: field, sortOrder: current.sortOrder === "asc" ? "desc" : "asc" };
}
