"use client";

import { useCallback, useMemo, useRef } from "react";
import { InfoIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/error-state";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import { useHotkey } from "@/lib/use-hotkey";

import { useCustomerListParams } from "../../hooks/use-customer-list-params";
import { useMoveCustomer } from "../../hooks/use-customer-mutations";
import { useCustomers } from "../../hooks/use-customers";
import { countActiveFilters } from "../../lib/list-params";
import { toBoardParams } from "../../lib/pipeline";
import type { MoveCustomerInput } from "../../lib/schemas";
import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  EMPTY_CUSTOMER_FILTERS,
  type Customer,
} from "../../types";
import {
  CustomerActionDialogs,
  useCustomerActions,
} from "../crud/customer-actions";
import { CustomersEmptyState } from "../customers-empty-state";
import { ActiveFiltersBar } from "../filters/active-filters-bar";
import { CustomerFiltersSheet } from "../filters/customer-filters-sheet";
import { PipelineBoard } from "./pipeline-board";

function BoardSkeleton() {
  return (
    <div
      className="flex flex-1 items-start gap-3 overflow-hidden"
      aria-busy
      aria-label="Loading pipeline"
    >
      {CUSTOMER_STATUSES.map((status, column) => (
        <div
          key={status}
          className="flex w-[82vw] max-w-72 shrink-0 flex-col gap-2 rounded-xl border bg-muted/40 p-2 sm:w-64 @5xl:w-auto @5xl:max-w-none @5xl:min-w-0 @5xl:flex-1"
        >
          <div className="flex items-center justify-between px-1 py-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          {Array.from({ length: 4 - (column % 2) }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PipelineView() {
  // The board shares the customers page's URL state, so the same search and
  // filter links work on both. Sorting and paging don't apply to a board.
  const { params, setSearch, setFilters } = useCustomerListParams();
  const boardParams = useMemo(
    () => toBoardParams(params.search, params.filters),
    [params.search, params.filters],
  );
  const { data, error, isPending, isError, isFetching, isPlaceholderData, refetch } =
    useCustomers(boardParams);
  const { move, isPending: isSaving } = useMoveCustomer(boardParams);
  const actions = useCustomerActions();

  const searchRef = useRef<HTMLInputElement>(null);

  useHotkey("n", actions.openCreate);
  useHotkey(
    "/",
    useCallback(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    }, []),
  );

  const handleMove = (customer: Customer, input: MoveCustomerInput) => {
    move(customer.id, input, {
      // The hook has already put the card back where it was.
      onError: (cause) =>
        toast.error(`Couldn't move ${customer.name}`, {
          description: `${getErrorMessage(cause)} The card was returned to ${CUSTOMER_STATUS_LABELS[customer.status]}.`,
        }),
    });
  };

  const hasSearch = params.search.length > 0;
  const hasFilters = countActiveFilters(params.filters) > 0;
  const isNarrowed = hasSearch || hasFilters;

  return (
    <div className="@container flex min-w-0 flex-1 flex-col gap-4">
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
          <div
            className="ml-auto flex items-center gap-2 text-sm whitespace-nowrap text-muted-foreground"
            aria-live="polite"
          >
            {(isSaving || (isFetching && !isPending)) && (
              <Loader2Icon
                className="size-4 animate-spin"
                aria-label={isSaving ? "Saving" : "Updating"}
              />
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

      {isError ? (
        <ErrorState
          title="Couldn't load the pipeline"
          message={getErrorMessage(error)}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      ) : isPending ? (
        <BoardSkeleton />
      ) : data.total === 0 ? (
        <CustomersEmptyState
          search={params.search}
          hasFilters={hasFilters}
          onClearSearch={() => setSearch("")}
          onClearFilters={() => setFilters(EMPTY_CUSTOMER_FILTERS)}
        />
      ) : (
        <>
          {(isNarrowed || data.total > data.items.length) && (
            <p
              role="note"
              className="flex items-start gap-2 text-xs text-muted-foreground"
            >
              <InfoIcon className="mt-px size-3.5 shrink-0" />
              <span>
                {data.total > data.items.length
                  ? `Showing the first ${formatNumber(data.items.length)} of ${formatNumber(data.total)} customers. `
                  : ""}
                {isNarrowed &&
                  "Only customers matching the current search and filters are shown. Column counts and card positions refer to these cards."}
              </span>
            </p>
          )}
          <div
            className={
              isPlaceholderData
                ? "flex min-w-0 flex-1 opacity-50 transition-opacity"
                : "flex min-w-0 flex-1 transition-opacity"
            }
            aria-busy={isPlaceholderData}
          >
            <PipelineBoard
              customers={data.items}
              onMove={handleMove}
              onOpen={(customer) => actions.handleAction("view", customer)}
            />
          </div>
        </>
      )}
    </div>
  );
}
