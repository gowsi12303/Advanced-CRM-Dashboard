import type { CustomerListParams } from "../types";

// Hierarchical keys: invalidating a prefix refetches everything beneath it.
//   ["customers"]                       everything customer-related
//   ["customers", "list", params]       one page of one filtered view
//   ["customers", "detail", id]         one customer
//   ["customers", "detail", id, "notes"]
//   ["customers", "companies"]          company filter options
export const customerKeys = {
  all: ["customers"] as const,
  lists: () => [...customerKeys.all, "list"] as const,
  list: (params: CustomerListParams) =>
    [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all, "detail"] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
  notes: (id: string) => [...customerKeys.detail(id), "notes"] as const,
  companies: () => [...customerKeys.all, "companies"] as const,
};

export const savedFilterKeys = {
  all: ["saved-filters"] as const,
};
