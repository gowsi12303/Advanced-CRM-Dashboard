import { useMutation } from "@tanstack/react-query";

import { downloadCsv } from "@/lib/csv";

import { customersApi } from "../api/customers-api";
import { customersCsvFilename, customersToCsv } from "../lib/export";
import { countActiveFilters } from "../lib/list-params";
import { MAX_PAGE_SIZE, type Customer, type CustomerListParams } from "../types";

/**
 * Downloads every customer matching the list's search and filters (in its
 * sort order) as a CSV file, not just the page on screen.
 *
 * This is a mutation rather than a query: it is a one-off action with a
 * side effect, and its rows should not be cached alongside the paged lists.
 */
export function useExportCustomers() {
  return useMutation({
    mutationFn: async (params: CustomerListParams) => {
      const customers: Customer[] = [];
      // The API caps the page size, so a large result is read page by page.
      for (let page = 1; ; page += 1) {
        const result = await customersApi.list({
          ...params,
          page,
          pageSize: MAX_PAGE_SIZE,
        });
        customers.push(...result.items);
        if (page >= result.totalPages) break;
      }

      const isNarrowed =
        params.search.length > 0 || countActiveFilters(params.filters) > 0;
      const filename = customersCsvFilename(new Date(), isNarrowed);
      downloadCsv(filename, customersToCsv(customers));
      return { count: customers.length, filename };
    },
  });
}
