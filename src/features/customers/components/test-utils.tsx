import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { Toaster } from "sonner";
import { expect } from "vitest";

import type { installMockApi } from "@/test/mock-api";

import type { CustomerListParams } from "../types";
import { CustomersView } from "./customers-view";
import { PipelineView } from "./pipeline/pipeline-view";

export type MockApi = ReturnType<typeof installMockApi>;

function renderWithProviders(view: React.ReactNode) {
  const queryClient = new QueryClient({
    // Same freshness window as the app, so caching behaves as it does there.
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {view}
      <Toaster />
    </QueryClientProvider>,
  );
}

/** Renders the customers view with a fresh query cache and no retries. */
export function renderCustomersView() {
  return renderWithProviders(<CustomersView />);
}

/** Renders the pipeline view with a fresh query cache and no retries. */
export function renderPipelineView() {
  return renderWithProviders(<PipelineView />);
}

/** Body rows only; the header row is excluded. */
export function dataRows() {
  return screen.getAllByRole("row").slice(1);
}

export function rowNames() {
  return dataRows().map(
    (row) => within(row).getAllByRole("button")[0].textContent,
  );
}

/**
 * Waits until the view shows exactly what the API returns for `params`: the
 * matching rows, or the empty state when nothing matches.
 */
export async function expectRowsFor(api: MockApi, params: CustomerListParams) {
  const expected = await api.expected(params);
  await waitFor(() => {
    if (expected.total === 0) {
      expect(screen.getByText("No customers found")).toBeInTheDocument();
      return;
    }
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "false");
    expect(rowNames()).toEqual(expected.items.map((c) => c.name));
  });
  return expected;
}
