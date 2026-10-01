import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { installMockApi } from "@/test/mock-api";
import { getMockSearch, setMockSearch } from "@/test/navigation-mock";

import { DEFAULT_CUSTOMER_LIST_PARAMS } from "../types";
import {
  dataRows,
  expectRowsFor,
  renderCustomersView as renderView,
  rowNames,
  type MockApi,
} from "./test-utils";

vi.mock("next/navigation", () => import("@/test/navigation-mock"));

const defaults = DEFAULT_CUSTOMER_LIST_PARAMS;

describe("CustomersView", () => {
  let api: MockApi;

  beforeEach(() => {
    setMockSearch("");
    api = installMockApi();
  });

  it("renders customer data from the API", async () => {
    renderView();
    const expected = await expectRowsFor(api, defaults);

    expect(dataRows()).toHaveLength(10);
    const first = expected.items[0];
    const row = within(dataRows()[0]);
    expect(row.getAllByText(first.email).length).toBeGreaterThan(0);
    expect(row.getAllByText(first.company).length).toBeGreaterThan(0);
    expect(row.getByText(first.phone)).toBeInTheDocument();
    expect(
      row.getByRole("button", { name: `Actions for ${first.name}` }),
    ).toBeInTheDocument();

    expect(screen.getByText("customers")).toHaveTextContent("150 customers");
    expect(screen.getByRole("navigation", { name: "Pagination" })).toHaveTextContent(
      "Showing 1–10 of 150 customers",
    );
    expect(screen.getByText("Page 1 of 15")).toBeInTheDocument();
  });

  it("shows skeleton rows while the first page loads", async () => {
    api.pause();
    const { container } = renderView();

    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
    expect(dataRows()).toHaveLength(10);
    expect(
      container.querySelectorAll("tbody [data-slot=skeleton]").length,
    ).toBeGreaterThan(10);
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();

    api.resume();
    await expectRowsFor(api, defaults);
    expect(container.querySelector("tbody [data-slot=skeleton]")).toBeNull();
  });

  it("debounces search and sends one request for the final term", async () => {
    const user = userEvent.setup();
    setMockSearch("page=3");
    renderView();
    await expectRowsFor(api, { ...defaults, page: 3 });
    const requestsBefore = api.listRequests.length;

    await user.type(screen.getByRole("searchbox", { name: "Search customers" }), "vela");
    // Nothing is requested while the user is still typing.
    expect(api.listRequests).toHaveLength(requestsBefore);

    const expected = await expectRowsFor(api, { ...defaults, search: "vela" });
    expect(expected.total).toBeGreaterThan(0);
    expect(expected.total).toBeLessThan(150);

    const searches = api.listRequests
      .slice(requestsBefore)
      .map((request) => request.get("q"));
    expect(searches).toEqual(["vela"]);
    // Searching returns to the first page and is reflected in the URL.
    expect(getMockSearch()).toBe("q=vela");
  });

  it("restores search from the URL and clears it", async () => {
    const user = userEvent.setup();
    setMockSearch("q=robotics");
    renderView();

    expect(screen.getByRole("searchbox")).toHaveValue("robotics");
    await expectRowsFor(api, { ...defaults, search: "robotics" });

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    await expectRowsFor(api, defaults);
    expect(getMockSearch()).toBe("");
  });

  it("sorts from the column headers and shows the direction", async () => {
    const user = userEvent.setup();
    setMockSearch("page=2");
    renderView();
    await expectRowsFor(api, { ...defaults, page: 2 });

    const nameHeader = screen.getByRole("columnheader", { name: "Name" });
    expect(nameHeader).toHaveAttribute("aria-sort", "none");
    expect(screen.getByRole("columnheader", { name: "Created" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );

    await user.click(within(nameHeader).getByRole("button"));
    await expectRowsFor(api, { ...defaults, sortBy: "name", sortOrder: "asc" });
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("columnheader", { name: "Created" })).toHaveAttribute(
      "aria-sort",
      "none",
    );
    expect(getMockSearch()).toBe("sortBy=name&sortOrder=asc");

    await user.click(within(nameHeader).getByRole("button"));
    await expectRowsFor(api, { ...defaults, sortBy: "name", sortOrder: "desc" });
    expect(nameHeader).toHaveAttribute("aria-sort", "descending");
    expect(api.listRequests.at(-1)?.get("sortOrder")).toBe("desc");
  });

  it("sorts date columns newest first on the first click", async () => {
    const user = userEvent.setup();
    renderView();
    await expectRowsFor(api, defaults);

    const header = screen.getByRole("columnheader", { name: "Last contact" });
    await user.click(within(header).getByRole("button"));
    await expectRowsFor(api, {
      ...defaults,
      sortBy: "lastContactedAt",
      sortOrder: "desc",
    });
    expect(header).toHaveAttribute("aria-sort", "descending");
  });

  it("pages through results, keeping the previous rows visible while loading", async () => {
    const user = userEvent.setup();
    renderView();
    const firstPage = await expectRowsFor(api, defaults);

    const previous = screen.getByRole("button", { name: "Previous page" });
    const next = screen.getByRole("button", { name: "Next page" });
    expect(previous).toBeDisabled();

    api.pause();
    await user.click(next);
    await waitFor(() =>
      expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true"),
    );
    // Still the old rows, not skeletons, while page 2 is in flight.
    expect(rowNames()).toEqual(firstPage.items.map((c) => c.name));

    api.resume();
    await expectRowsFor(api, { ...defaults, page: 2 });
    expect(screen.getByRole("navigation", { name: "Pagination" })).toHaveTextContent(
      "Showing 11–20 of 150 customers",
    );
    expect(screen.getByText("Page 2 of 15")).toBeInTheDocument();
    expect(getMockSearch()).toBe("page=2");
    expect(previous).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Last page" }));
    await expectRowsFor(api, { ...defaults, page: 15 });
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "First page" }));
    await expectRowsFor(api, defaults);
    expect(getMockSearch()).toBe("");
  });

  it.each([25, 50])("changes the page size to %i and returns to page 1", async (size) => {
    const user = userEvent.setup();
    setMockSearch("q=a&sortBy=name&sortOrder=asc&page=2");
    renderView();
    const base = { ...defaults, search: "a", sortBy: "name", sortOrder: "asc" } as const;
    await expectRowsFor(api, { ...base, page: 2 });

    await user.click(screen.getByRole("combobox", { name: "Rows per page" }));
    await user.click(await screen.findByRole("option", { name: String(size) }));

    const expected = await expectRowsFor(api, { ...base, pageSize: size });
    expect(dataRows()).toHaveLength(Math.min(size, expected.total));
    // Search and sort survive; only the page resets.
    expect(getMockSearch()).toBe(`q=a&sortBy=name&sortOrder=asc&pageSize=${size}`);
    expect(api.listRequests.at(-1)?.get("pageSize")).toBe(String(size));
    expect(api.listRequests.at(-1)?.get("page")).toBe("1");
  });

  it("shows an empty state when nothing matches and can clear the search", async () => {
    const user = userEvent.setup();
    setMockSearch("q=zzzz-no-match");
    renderView();

    expect(await screen.findByText("No customers found")).toBeInTheDocument();
    expect(screen.getByText(/Nothing matches “zzzz-no-match”/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();

    const emptyState = screen.getByText("No customers found").closest("div")!
      .parentElement!;
    await user.click(within(emptyState).getByRole("button", { name: "Clear search" }));
    await expectRowsFor(api, defaults);
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("shows an error state and recovers on Retry", async () => {
    const user = userEvent.setup();
    api.setFailing(true);
    renderView();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load customers");
    expect(alert).toHaveTextContent("Database unavailable");
    expect(screen.queryByRole("table")).toBeNull();

    // A retry that fails again keeps the error on screen.
    await user.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(api.listRequests).toHaveLength(2));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    api.setFailing(false);
    await user.click(
      within(screen.getByRole("alert")).getByRole("button", { name: "Retry" }),
    );
    await expectRowsFor(api, defaults);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
