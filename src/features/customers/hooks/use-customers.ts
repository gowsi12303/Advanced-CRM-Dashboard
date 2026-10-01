import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { customersApi } from "../api/customers-api";
import type { CustomerListParams } from "../types";
import { customerKeys } from "./query-keys";

/** One page of customers for the given search, filters, sort and pagination. */
export function useCustomers(params: CustomerListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: ({ signal }) => customersApi.list(params, signal),
    // Keep showing the current rows while the next page or filter loads,
    // instead of flashing a skeleton; `isPlaceholderData` tells the UI to dim them.
    placeholderData: keepPreviousData,
  });
}

/** A single customer. Pass `null` while no customer is selected. */
export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? ""),
    queryFn: ({ signal }) => customersApi.get(id ?? "", signal),
    enabled: id !== null,
  });
}

export function useCustomerNotes(customerId: string | null) {
  return useQuery({
    queryKey: customerKeys.notes(customerId ?? ""),
    queryFn: ({ signal }) => customersApi.listNotes(customerId ?? "", signal),
    enabled: customerId !== null,
  });
}

/** Distinct company names for the company filter. */
export function useCompanies() {
  return useQuery({
    queryKey: customerKeys.companies(),
    queryFn: ({ signal }) => customersApi.listCompanies(signal),
    // Options change rarely and are invalidated by customer mutations anyway.
    staleTime: 5 * 60 * 1000,
  });
}
