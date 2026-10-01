"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DownloadIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { ErrorState } from "@/components/shared/error-state";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import { useHotkey } from "@/lib/use-hotkey";

import { useCustomerListParams } from "../hooks/use-customer-list-params";
import { useCustomers } from "../hooks/use-customers";
import { useExportCustomers } from "../hooks/use-export-customers";
import { countActiveFilters } from "../lib/list-params";
import {
  EMPTY_CUSTOMER_FILTERS,
  PAGE_SIZE_OPTIONS,
  type CustomerSortField,
} from "../types";
import { BulkActionsBar } from "./bulk-actions-bar";
import {
  CustomerActionDialogs,
  useCustomerActions,
} from "./crud/customer-actions";
import { nextSort } from "./customer-sort";
import { CustomerSortMenu } from "./customer-sort-menu";
import { CustomersEmptyState } from "./customers-empty-state";
import { CustomersTable } from "./customers-table";
import { ActiveFiltersBar } from "./filters/active-filters-bar";
import { CustomerFiltersSheet } from "./filters/customer-filters-sheet";

export function CustomersView() {
  const { params, setSearch, setFilters, setSort, setPage, setPageSize } =
    useCustomerListParams();
  const { data, error, isPending, isError, isFetching, isPlaceholderData, refetch } =
    useCustomers(params);
  const actions = useCustomerActions();

  const exportCustomers = useExportCustomers();
  const searchRef = useRef<HTMLInputElement>(null);

  useHotkey("n", actions.openCreate);
  useHotkey(
    "/",
    useCallback(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    }, []),
  );

  // Selection is limited to the rows on screen. It is dropped whenever the
  // search, filters, sort or page change, and anything selected that is no
  // longer among the visible rows is ignored, so a bulk action can never touch
  // a customer the user can't see.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [selectionParams, setSelectionParams] = useState(params);
  if (params !== selectionParams) {
    setSelectionParams(params);
    setSelectedIds(new Set());
  }
  const visible = data?.items;
  const selected = useMemo(
    () => (visible ?? []).filter((customer) => selectedIds.has(customer.id)),
    [visible, selectedIds],
  );
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const handleSelect = useCallback((customerId: string, isSelected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (isSelected) next.add(customerId);
      else next.delete(customerId);
      return next;
    });
  }, []);
  const handleSelectAll = useCallback(
    (isSelected: boolean) => {
      setSelectedIds(
        new Set(isSelected ? (visible ?? []).map((customer) => customer.id) : []),
      );
    },
    [visible],
  );

  const handleExport = () => {
    exportCustomers.mutate(params, {
      onSuccess: ({ count, filename }) =>
        toast.success(
          `Exported ${formatNumber(count)} ${count === 1 ? "customer" : "customers"}`,
          { description: filename },
        ),
      onError: (cause) =>
        toast.error("Couldn't export customers", {
          description: getErrorMessage(cause),
        }),
    });
  };

  // The API clamps a page past the end to the last page, e.g. after deleting
  // the only row on the final page. Bring the URL back in line with it.
  const servedPage = data && !isPlaceholderData ? data.page : null;
  useEffect(() => {
    if (servedPage !== null && servedPage !== params.page) {
      setPage(servedPage, "replace");
    }
  }, [servedPage, params.page, setPage]);

  const handleSort = useCallback(
    (field: CustomerSortField) => {
      const next = nextSort(params, field);
      setSort(next.sortBy, next.sortOrder);
    },
    [params, setSort],
  );

  return (
    <div className="@container flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={params.search}
          onChange={setSearch}
          placeholder="Search name, email, phone or company"
          aria-label="Search customers"
          className="w-full sm:max-w-sm"
          ref={searchRef}
          shortcutHint="/"
        />
        <div className="flex flex-1 items-center gap-2">
          <CustomerFiltersSheet applied={params.filters} onApply={setFilters} />
          <CustomerSortMenu
            sortBy={params.sortBy}
            sortOrder={params.sortOrder}
            onSortChange={setSort}
            // Only needed while some sortable column headers are hidden.
            className="@6xl:hidden"
          />
          {/* In a narrow toolbar the total is shown by the pagination summary instead. */}
          <div
            className="ml-auto hidden items-center gap-2 text-sm whitespace-nowrap text-muted-foreground @3xl:flex"
            aria-live="polite"
          >
            {isFetching && !isPending && (
              <Loader2Icon className="size-4 animate-spin" aria-label="Updating" />
            )}
            {data ? (
              <span>
                <span className="font-medium text-foreground tabular-nums">
                  {formatNumber(data.total)}
                </span>{" "}
                {data.total === 1 ? "customer" : "customers"}
              </span>
            ) : (
              isPending && <Skeleton className="h-4 w-24" />
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exportCustomers.isPending || !data || data.total === 0}
            className="ml-auto @3xl:ml-0"
            title="Export the matching customers as CSV"
          >
            {exportCustomers.isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <DownloadIcon />
            )}
            <span className="sr-only @3xl:not-sr-only">Export CSV</span>
          </Button>
          <Button
            onClick={actions.openCreate}
            aria-keyshortcuts="n"
            title="Add customer (N)"
          >
            <PlusIcon />
            {/* The short label is used whenever the toolbar is tight, not only on phones. */}
            <span className="sr-only @3xl:not-sr-only">Add customer</span>
            <span aria-hidden className="@3xl:hidden">
              Add
            </span>
          </Button>
        </div>
      </div>

      <ActiveFiltersBar applied={params.filters} onApply={setFilters} />
      <CustomerActionDialogs actions={actions} />
      <BulkActionsBar selected={selected} onClear={clearSelection} />

      {isError ? (
        <ErrorState
          title="Couldn't load customers"
          message={getErrorMessage(error)}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      ) : data && data.total === 0 ? (
        <CustomersEmptyState
          search={params.search}
          hasFilters={countActiveFilters(params.filters) > 0}
          onClearSearch={() => setSearch("")}
          onClearFilters={() => setFilters(EMPTY_CUSTOMER_FILTERS)}
        />
      ) : (
        <>
          <CustomersTable
            customers={data?.items}
            skeletonRows={params.pageSize}
            isStale={isPlaceholderData}
            sortBy={params.sortBy}
            sortOrder={params.sortOrder}
            onSort={handleSort}
            onAction={actions.handleAction}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
          />
          {data && (
            <DataTablePagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="customers"
            />
          )}
        </>
      )}
    </div>
  );
}
