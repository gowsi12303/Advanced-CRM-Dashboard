import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toLocalDateOnly } from "@/lib/format";
import { installMockApi } from "@/test/mock-api";
import { getMockSearch, mockBack, setMockSearch } from "@/test/navigation-mock";

import { CUSTOMER_CSV_HEADERS } from "../lib/export";
import {
  DEFAULT_CUSTOMER_LIST_PARAMS,
  EMPTY_CUSTOMER_FILTERS,
  type Customer,
  type CustomerListParams,
} from "../types";
import {
  dataRows,
  expectRowsFor,
  renderCustomersView,
  rowNames,
  type MockApi,
} from "./test-utils";

vi.mock("next/navigation", () => import("@/test/navigation-mock"));

const defaults = DEFAULT_CUSTOMER_LIST_PARAMS;
const isMutation = (method: string) => method !== "GET";

describe("bulk selection, bulk actions, export and shortcuts", () => {
  let api: MockApi;
  let user: UserEvent;

  beforeEach(() => {
    toast.dismiss();
    setMockSearch("");
    api = installMockApi();
    user = userEvent.setup();
  });

  async function renderLoaded(params: CustomerListParams = defaults) {
    renderCustomersView();
    return expectRowsFor(api, params);
  }

  const rowCheckbox = (customer: Customer) =>
    screen.getByRole("checkbox", { name: `Select ${customer.name}` });
  const rowCheckboxes = () => screen.getAllByRole("checkbox", { name: /^Select (?!all)/ });
  const selectAll = () =>
    screen.getByRole("checkbox", { name: "Select all customers on this page" });
  const bulkBar = () => within(screen.getByRole("region", { name: "Bulk actions" }));
  const queryBulkBar = () => screen.queryByRole("region", { name: "Bulk actions" });
  const expectSelected = (count: number) =>
    expect(screen.getByRole("region", { name: "Bulk actions" })).toHaveTextContent(
      new RegExp(`^${count}\\s*selected`),
    );
  const selectedCount = () => rowCheckboxes().filter((box) => box.getAttribute("aria-checked") === "true").length;

  describe("selection", () => {
    it("selects one row and shows the count", async () => {
      const { items } = await renderLoaded();
      expect(queryBulkBar()).toBeNull();
      expect(selectAll()).toHaveAttribute("aria-checked", "false");

      await user.click(rowCheckbox(items[2]));

      expect(rowCheckbox(items[2])).toBeChecked();
      expect(selectedCount()).toBe(1);
      expectSelected(1);
      // Some but not all rows: the header checkbox is in its mixed state.
      expect(selectAll()).toHaveAttribute("aria-checked", "mixed");
      expect(dataRows()[2]).toHaveAttribute("data-state", "selected");
      // Selecting is local; nothing is sent.
      expect(api.mutations).toHaveLength(0);
    });

    it("selects every visible row, and only those", async () => {
      await renderLoaded();

      await user.click(selectAll());

      expect(selectedCount()).toBe(10);
      expect(rowCheckboxes()).toHaveLength(10);
      expect(selectAll()).toBeChecked();
      // 10 on this page, not all 150 matching customers.
      expectSelected(10);
    });

    it("deselects a row, all rows, and clears from the bar", async () => {
      const { items } = await renderLoaded();

      await user.click(selectAll());
      await user.click(rowCheckbox(items[0]));
      expect(selectedCount()).toBe(9);
      expect(selectAll()).toHaveAttribute("aria-checked", "mixed");
      expectSelected(9);

      // From the mixed state, the header checkbox selects everything again…
      await user.click(selectAll());
      expect(selectedCount()).toBe(10);
      // …and then clears everything.
      await user.click(selectAll());
      expect(selectedCount()).toBe(0);
      expect(queryBulkBar()).toBeNull();

      await user.click(rowCheckbox(items[1]));
      await user.click(bulkBar().getByRole("button", { name: "Clear selection" }));
      expect(selectedCount()).toBe(0);
      expect(queryBulkBar()).toBeNull();
    });

    it.each([
      ["the page changes", async (u: UserEvent) => u.click(screen.getByRole("button", { name: "Next page" })), { ...defaults, page: 2 }],
      [
        "the sort changes",
        async (u: UserEvent) =>
          u.click(within(screen.getByRole("columnheader", { name: "Name" })).getByRole("button")),
        { ...defaults, sortBy: "name", sortOrder: "asc" } as CustomerListParams,
      ],
      [
        "a search is made",
        async (u: UserEvent) => u.type(screen.getByRole("searchbox", { name: "Search customers" }), "quartz"),
        { ...defaults, search: "quartz" },
      ],
    ])("drops the selection when %s", async (_label, change, nextParams) => {
      await renderLoaded();
      await user.click(selectAll());
      expect(selectedCount()).toBe(10);

      await change(user);
      await expectRowsFor(api, nextParams);

      expect(selectedCount()).toBe(0);
      expect(queryBulkBar()).toBeNull();
    });

    it("drops the selection when filters are applied", async () => {
      const { items } = await renderLoaded();
      await user.click(rowCheckbox(items[0]));

      await user.click(screen.getByRole("button", { name: /^Filters/ }));
      const panel = within(screen.getByRole("dialog", { name: "Filters" }));
      await user.click(panel.getByRole("checkbox", { name: "Churned" }));
      await user.click(panel.getByRole("button", { name: "Apply filters" }));
      await expectRowsFor(api, {
        ...defaults,
        filters: { ...EMPTY_CUSTOMER_FILTERS, status: ["churned"] },
      });

      expect(selectedCount()).toBe(0);
      expect(queryBulkBar()).toBeNull();
    });

    it("keeps the selection while a customer's details are open", async () => {
      const { items } = await renderLoaded();
      await user.click(rowCheckbox(items[0]));
      await user.click(rowCheckbox(items[1]));
      const requestsBefore = api.listRequests.length;

      await user.click(screen.getByRole("button", { name: items[4].name }));
      await screen.findByRole("dialog", { name: items[4].name });
      await user.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      expect(selectedCount()).toBe(2);
      expectSelected(2);
      // Opening the drawer changes the URL but is not a new list request.
      expect(api.listRequests).toHaveLength(requestsBefore);
    });
  });

  describe("bulk status change", () => {
    it("changes the status of the selected rows, with a pending state", async () => {
      setMockSearch("status=lead&status=prospect");
      const params = {
        ...defaults,
        filters: { ...EMPTY_CUSTOMER_FILTERS, status: ["lead", "prospect"] as Customer["status"][] },
      };
      const { items } = await renderLoaded(params);
      const chosen = [items[0], items[3], items[5]];
      for (const customer of chosen) await user.click(rowCheckbox(customer));

      await user.click(bulkBar().getByRole("button", { name: "Change status" }));
      expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
        "Lead",
        "Prospect",
        "Active",
        "Inactive",
        "Churned",
      ]);

      api.pause(isMutation);
      await user.click(screen.getByRole("menuitem", { name: "Active" }));
      const pending = await bulkBar().findByRole("button", { name: "Updating…" });
      expect(pending).toBeDisabled();
      expect(bulkBar().getByRole("button", { name: "Delete" })).toBeDisabled();
      expect(bulkBar().getByRole("button", { name: "Clear selection" })).toBeDisabled();
      expect(api.mutations).toEqual([
        {
          method: "POST",
          path: "/api/customers/bulk",
          body: { action: "updateStatus", ids: chosen.map((c) => c.id), status: "active" },
        },
      ]);

      api.resume();
      expect(await screen.findByText("Changed 3 customers to Active")).toBeInTheDocument();
      for (const customer of chosen) {
        expect((await api.repository.get(customer.id)).status).toBe("active");
      }
      // They no longer match the filter, the list refreshed, and the selection is gone.
      await expectRowsFor(api, params);
      for (const customer of chosen) expect(rowNames()).not.toContain(customer.name);
      expect(queryBulkBar()).toBeNull();
      expect(getMockSearch()).toBe("status=lead&status=prospect");
    });

    it("says so when some or all already had that status", async () => {
      setMockSearch("sortBy=status&sortOrder=asc&pageSize=50");
      const params = { ...defaults, sortBy: "status", sortOrder: "asc", pageSize: 50 } as const;
      const { items } = await renderLoaded(params);
      const leads = items.filter((c) => c.status === "lead").slice(0, 2);
      const prospect = items.find((c) => c.status === "prospect") as Customer;

      for (const customer of [...leads, prospect]) await user.click(rowCheckbox(customer));
      await user.click(bulkBar().getByRole("button", { name: "Change status" }));
      await user.click(await screen.findByRole("menuitem", { name: "Lead" }));
      expect(await screen.findByText("Changed 1 customer to Lead")).toBeInTheDocument();
      expect(screen.getByText("2 already had that status.")).toBeInTheDocument();

      await expectRowsFor(api, params);
      for (const customer of leads) await user.click(rowCheckbox(customer));
      await user.click(bulkBar().getByRole("button", { name: "Change status" }));
      await user.click(await screen.findByRole("menuitem", { name: "Lead" }));
      expect(
        await screen.findByText("All 2 selected customers were already Lead"),
      ).toBeInTheDocument();
    });

    it("reports an API error and keeps the selection", async () => {
      const { items } = await renderLoaded();
      await user.click(rowCheckbox(items[0]));
      await user.click(rowCheckbox(items[1]));
      api.failWhen(isMutation);

      await user.click(bulkBar().getByRole("button", { name: "Change status" }));
      await user.click(await screen.findByRole("menuitem", { name: "Churned" }));

      expect(await screen.findByText("Couldn't change the status")).toBeInTheDocument();
      expect(screen.getByText("Database unavailable")).toBeInTheDocument();
      expect(selectedCount()).toBe(2);
      expect(bulkBar().getByRole("button", { name: "Change status" })).toBeEnabled();
      expect((await api.repository.get(items[0].id)).status).toBe(items[0].status);
    });
  });

  describe("bulk delete", () => {
    it("confirms with the number and names, and cancels cleanly", async () => {
      const { items } = await renderLoaded();
      for (const customer of items.slice(0, 4)) await user.click(rowCheckbox(customer));

      await user.click(bulkBar().getByRole("button", { name: "Delete" }));
      const dialog = within(
        await screen.findByRole("alertdialog", { name: "Delete 4 customers?" }),
      );
      expect(
        dialog.getByText(`${items[0].name}, ${items[1].name} and 2 more`),
      ).toBeVisible();
      expect(dialog.getByRole("button", { name: "Delete 4 customers" })).toBeEnabled();

      await user.click(dialog.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(api.mutations).toHaveLength(0);
      expect(selectedCount()).toBe(4);
      expect(await api.allCustomers()).toHaveLength(150);
    });

    it("uses singular wording for one customer", async () => {
      const { items } = await renderLoaded();
      await user.click(rowCheckbox(items[0]));
      await user.click(bulkBar().getByRole("button", { name: "Delete" }));

      const dialog = within(await screen.findByRole("alertdialog", { name: "Delete 1 customer?" }));
      expect(dialog.getByText(items[0].name)).toBeVisible();
      expect(dialog.getByRole("button", { name: "Delete 1 customer" })).toBeEnabled();
    });

    it("deletes the selected rows, disabling actions while pending", async () => {
      const { items } = await renderLoaded();
      const chosen = items.slice(1, 4);
      for (const customer of chosen) await user.click(rowCheckbox(customer));

      await user.click(bulkBar().getByRole("button", { name: "Delete" }));
      const dialog = within(await screen.findByRole("alertdialog"));
      api.pause(isMutation);
      await user.click(dialog.getByRole("button", { name: "Delete 3 customers" }));

      expect(await dialog.findByRole("button", { name: "Deleting…" })).toBeDisabled();
      expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
      expect(api.mutations).toEqual([
        {
          method: "POST",
          path: "/api/customers/bulk",
          body: { action: "delete", ids: chosen.map((c) => c.id) },
        },
      ]);

      api.resume();
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(await screen.findByText("Deleted 3 customers")).toBeInTheDocument();
      expect(await api.allCustomers()).toHaveLength(147);

      await expectRowsFor(api, defaults);
      for (const customer of chosen) expect(rowNames()).not.toContain(customer.name);
      expect(dataRows()).toHaveLength(10);
      expect(queryBulkBar()).toBeNull();
      expect(screen.getByRole("navigation", { name: "Pagination" })).toHaveTextContent(
        "of 147 customers",
      );
    });

    it("keeps the dialog open and deletes nothing when the API fails", async () => {
      const { items } = await renderLoaded();
      await user.click(rowCheckbox(items[0]));
      await user.click(rowCheckbox(items[1]));
      const restore = api.failWhen(isMutation);

      await user.click(bulkBar().getByRole("button", { name: "Delete" }));
      const dialog = within(await screen.findByRole("alertdialog"));
      await user.click(dialog.getByRole("button", { name: "Delete 2 customers" }));

      expect(
        await screen.findByText("Couldn't delete the selected customers"),
      ).toBeInTheDocument();
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(await api.allCustomers()).toHaveLength(150);

      restore();
      await user.click(dialog.getByRole("button", { name: "Delete 2 customers" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(await api.allCustomers()).toHaveLength(148);
    });

    it("steps back a page after deleting every row on the last page", async () => {
      setMockSearch("page=15");
      await renderLoaded({ ...defaults, page: 15 });

      await user.click(selectAll());
      await user.click(bulkBar().getByRole("button", { name: "Delete" }));
      const dialog = within(await screen.findByRole("alertdialog", { name: "Delete 10 customers?" }));
      await user.click(dialog.getByRole("button", { name: "Delete 10 customers" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

      await expectRowsFor(api, { ...defaults, page: 14 });
      expect(screen.getByText("Page 14 of 14")).toBeInTheDocument();
      await waitFor(() => expect(getMockSearch()).toBe("page=14"));
      expect(queryBulkBar()).toBeNull();
    });

    it("only ever acts on rows that are on screen", async () => {
      setMockSearch("q=quartz&pageSize=50");
      const { items, total } = await renderLoaded({ ...defaults, search: "quartz", pageSize: 50 });
      expect(total).toBeLessThan(50);

      await user.click(selectAll());
      await user.click(bulkBar().getByRole("button", { name: "Delete" }));
      const dialog = within(await screen.findByRole("alertdialog"));
      await user.click(dialog.getByRole("button", { name: `Delete ${total} customers` }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

      expect(api.mutations[0].body).toEqual({
        action: "delete",
        ids: items.map((c) => c.id),
      });
      const remaining = await api.allCustomers();
      expect(remaining).toHaveLength(150 - total);
      expect(remaining.some((c) => c.company === "Quartz Financial")).toBe(false);
      expect(await screen.findByText("No customers found")).toBeInTheDocument();
    });
  });

  describe("CSV export", () => {
    let downloads: { filename: string; blob: Blob }[];
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;

    beforeEach(() => {
      downloads = [];
      let lastBlob: Blob | null = null;
      // jsdom implements neither object URLs nor downloads.
      URL.createObjectURL = (blob: Blob | MediaSource) => {
        lastBlob = blob as Blob;
        return "blob:mock";
      };
      URL.revokeObjectURL = () => {};
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        if (lastBlob) downloads.push({ filename: this.download, blob: lastBlob });
      });
    });

    afterEach(() => {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    });

    function readText(blob: Blob) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });
    }

    const exportButton = () => screen.getByRole("button", { name: "Export CSV" });
    // The filename carries the date the export ran. Each test reads the clock
    // on both sides of the export and accepts either day, so a test run that
    // crosses midnight doesn't fail.
    const today = () => toLocalDateOnly(new Date());

    it("exports every customer when nothing is filtered, not just the page", async () => {
      await renderLoaded();
      const before = today();

      await user.click(exportButton());
      expect(await screen.findByText("Exported 150 customers")).toBeInTheDocument();

      expect(downloads).toHaveLength(1);
      expect([`customers-${before}.csv`, `customers-${today()}.csv`]).toContain(
        downloads[0].filename,
      );
      expect(downloads[0].blob.type).toBe("text/csv;charset=utf-8");
      const lines = (await readText(downloads[0].blob)).split("\r\n");
      expect(lines[0]).toBe(CUSTOMER_CSV_HEADERS.join(","));
      expect(lines).toHaveLength(151);
      // The table still shows its 10 rows; the export made its own request.
      expect(dataRows()).toHaveLength(10);
      expect(api.listRequests.at(-1)?.get("pageSize")).toBe("500");
    });

    it("exports the filtered and searched set, in the table's order", async () => {
      setMockSearch("q=a&status=active&sortBy=name&sortOrder=asc&page=2");
      const params = {
        ...defaults,
        search: "a",
        filters: { ...EMPTY_CUSTOMER_FILTERS, status: ["active"] as Customer["status"][] },
        sortBy: "name",
        sortOrder: "asc",
      } as const;
      await renderLoaded({ ...params, page: 2 });
      const everyMatch = await api.expected({ ...params, pageSize: 500 });
      expect(everyMatch.total).toBeGreaterThan(20);
      const before = today();

      await user.click(exportButton());
      expect(
        await screen.findByText(`Exported ${everyMatch.total} customers`),
      ).toBeInTheDocument();

      expect([
        `customers-filtered-${before}.csv`,
        `customers-filtered-${today()}.csv`,
      ]).toContain(downloads[0].filename);
      const lines = (await readText(downloads[0].blob)).split("\r\n");
      expect(lines).toHaveLength(everyMatch.total + 1);
      expect(lines.slice(1).map((line) => line.split(",")[0])).toEqual(
        everyMatch.items.map((c) => c.name),
      );
      expect(lines.slice(1).every((line) => line.includes(",Active,"))).toBe(true);

      const request = api.listRequests.at(-1);
      expect(request?.get("q")).toBe("a");
      expect(request?.getAll("status")).toEqual(["active"]);
      expect(request?.get("page")).toBe("1");
      // Exporting does not disturb the table.
      expect(getMockSearch()).toBe("q=a&status=active&sortBy=name&sortOrder=asc&page=2");
    });

    it("escapes awkward values in the downloaded file", async () => {
      await api.repository.create({
        name: 'Dwayne "Rock" Johnson',
        email: "dwayne@example.com",
        phone: "+1 415 555 0100",
        company: "Smith, Jones & Co",
        jobTitle: "",
        status: "lead",
      });
      setMockSearch("q=dwayne");
      await renderLoaded({ ...defaults, search: "dwayne" });

      await user.click(exportButton());
      await screen.findByText("Exported 1 customer");

      const lines = (await readText(downloads[0].blob)).split("\r\n");
      expect(lines[1].startsWith(
        '"Dwayne ""Rock"" Johnson",dwayne@example.com,\'+1 415 555 0100,"Smith, Jones & Co",,Lead,,,',
      )).toBe(true);
    });

    it("shows a pending state and reports a failure", async () => {
      await renderLoaded();

      api.pause();
      await user.click(exportButton());
      await waitFor(() => expect(exportButton()).toBeDisabled());
      api.resume();
      await screen.findByText("Exported 150 customers");
      await waitFor(() => expect(exportButton()).toBeEnabled());

      // Only the export's own (page size 500) request fails.
      api.setFailing(true);
      await user.click(exportButton());
      expect(await screen.findByText("Couldn't export customers")).toBeInTheDocument();
      expect(downloads).toHaveLength(1);
    });

    it("is disabled when there is nothing to export", async () => {
      setMockSearch("q=zzzz-no-match");
      renderCustomersView();
      await screen.findByText("No customers found");
      expect(exportButton()).toBeDisabled();
    });
  });

  describe("keyboard shortcuts", () => {
    const search = () => screen.getByRole("searchbox", { name: "Search customers" });

    it("focuses the search box with /", async () => {
      await renderLoaded();
      expect(search()).not.toHaveFocus();

      await user.keyboard("/");

      expect(search()).toHaveFocus();
      // The slash is a shortcut, not input.
      expect(search()).toHaveValue("");
      expect(search()).toHaveAttribute("aria-keyshortcuts", "/");
    });

    it("selects the existing term so typing replaces it", async () => {
      setMockSearch("q=quartz");
      await renderLoaded({ ...defaults, search: "quartz" });

      await user.keyboard("/");
      await user.keyboard("vela");

      expect(search()).toHaveValue("vela");
      await expectRowsFor(api, { ...defaults, search: "vela" });
    });

    it("types a slash normally inside a field", async () => {
      await renderLoaded();

      await user.type(search(), "a/b");
      expect(search()).toHaveValue("a/b");
    });

    it("ignores / while a dialog, sheet or menu is open", async () => {
      const { items } = await renderLoaded();

      // While a dialog or menu is open the page behind it is hidden from the
      // accessibility tree, so keep hold of the element itself.
      const searchBox = search();

      await user.click(screen.getByRole("button", { name: /^Filters/ }));
      await screen.findByRole("dialog", { name: "Filters" });
      await user.keyboard("/");
      expect(searchBox).not.toHaveFocus();
      await user.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      await user.click(screen.getByRole("button", { name: `Actions for ${items[0].name}` }));
      await screen.findByRole("menu");
      await user.keyboard("/");
      expect(searchBox).not.toHaveFocus();
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("still opens Add customer with N", async () => {
      await renderLoaded();

      await user.keyboard("n");
      expect(await screen.findByRole("dialog", { name: "Add customer" })).toBeInTheDocument();
    });
  });

  describe("focus restoration", () => {
    it("returns focus to the customer's name when the drawer closes", async () => {
      const { items } = await renderLoaded();
      const nameButton = screen.getByRole("button", { name: items[3].name });

      await user.click(nameButton);
      await screen.findByRole("dialog", { name: items[3].name });
      expect(nameButton).not.toHaveFocus();

      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(nameButton).toHaveFocus());
    });

    it("returns focus to the row's menu button after a dialog opened from the menu", async () => {
      const { items } = await renderLoaded();
      const menuButton = screen.getByRole("button", { name: `Actions for ${items[0].name}` });

      await user.click(menuButton);
      await user.click(await screen.findByRole("menuitem", { name: "Log contact" }));
      const dialog = within(await screen.findByRole("dialog", { name: "Log contact" }));
      await user.click(dialog.getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(menuButton).toHaveFocus());
    });

    it("returns focus to the button that opened a confirmation", async () => {
      const { items } = await renderLoaded();
      await user.click(rowCheckbox(items[0]));
      const deleteButton = bulkBar().getByRole("button", { name: "Delete" });

      await user.click(deleteButton);
      const dialog = within(await screen.findByRole("alertdialog"));
      await user.click(dialog.getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      await waitFor(() => expect(deleteButton).toHaveFocus());
    });
  });

  describe("details drawer in the URL", () => {
    it("opens the drawer from a link and closes with Back", async () => {
      const first = (await api.expected(defaults)).items[0];
      setMockSearch(`customer=${first.id}`);
      renderCustomersView();

      const drawer = within(await screen.findByRole("dialog", { name: first.name }));
      expect(await drawer.findByRole("link", { name: first.email })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(getMockSearch()).toBe("");
      // The list behind the drawer loaded as usual.
      await expectRowsFor(api, defaults);

      mockBack();
      expect(await screen.findByRole("dialog", { name: first.name })).toBeInTheDocument();
    });

    it("keeps list state and the drawer side by side in the URL", async () => {
      setMockSearch("q=a&sortBy=name&sortOrder=asc");
      const params = { ...defaults, search: "a", sortBy: "name", sortOrder: "asc" } as const;
      const { items } = await renderLoaded(params);

      await user.click(screen.getByRole("button", { name: items[0].name }));
      await screen.findByRole("dialog", { name: items[0].name });
      expect(getMockSearch()).toBe(`q=a&sortBy=name&sortOrder=asc&customer=${items[0].id}`);

      await user.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(getMockSearch()).toBe("q=a&sortBy=name&sortOrder=asc");

      // List changes leave unrelated URL state alone.
      setMockSearch(`fail=0&q=a&customer=${items[1].id}`);
      await screen.findByRole("dialog", { name: items[1].name });
      await user.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await user.click(screen.getByRole("button", { name: "Next page" }));
      await waitFor(() => expect(getMockSearch()).toBe("fail=0&q=a&page=2"));
    });
  });
});
