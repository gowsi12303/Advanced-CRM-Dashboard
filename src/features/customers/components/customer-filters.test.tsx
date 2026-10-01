import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { installMockApi } from "@/test/mock-api";
import {
  getMockSearch,
  mockBack,
  mockForward,
  setMockSearch,
} from "@/test/navigation-mock";

import { FILTER_TEMPLATES } from "../lib/filter-templates";
import {
  DEFAULT_CUSTOMER_LIST_PARAMS,
  EMPTY_CUSTOMER_FILTERS,
  type CustomerFilters,
} from "../types";
import {
  expectRowsFor,
  renderCustomersView,
  rowNames,
  type MockApi,
} from "./test-utils";

vi.mock("next/navigation", () => import("@/test/navigation-mock"));

const defaults = DEFAULT_CUSTOMER_LIST_PARAMS;
const withFilters = (filters: Partial<CustomerFilters>) => ({
  ...defaults,
  filters: { ...EMPTY_CUSTOMER_FILTERS, ...filters },
});

const filtersButton = () => screen.getByRole("button", { name: /^Filters/ });
const panel = () => within(screen.getByRole("dialog", { name: "Filters" }));
const chips = () =>
  within(screen.getByRole("list", { name: "Active filters" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent?.replace(/Remove filter.*/, ""));

async function openPanel(user: UserEvent) {
  await user.click(filtersButton());
  return panel();
}

async function apply(user: UserEvent) {
  await user.click(panel().getByRole("button", { name: "Apply filters" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

async function tickCompany(user: UserEvent, name: string) {
  const group = await panel().findByRole("group", { name: "Companies" });
  await user.click(within(group).getByRole("checkbox", { name }));
}

function setDate(label: "From" | "To", value: string) {
  fireEvent.change(panel().getByLabelText(label), { target: { value } });
}

/** Saves the currently applied filters under `name` via the bar above the table. */
async function saveAppliedAs(user: UserEvent, name: string) {
  await user.click(screen.getByRole("button", { name: "Save filter" }));
  const dialog = within(screen.getByRole("dialog", { name: "Save filter" }));
  await user.type(dialog.getByLabelText("Name"), name);
  await user.click(dialog.getByRole("button", { name: "Save" }));
  return dialog;
}

describe("customer filters", () => {
  let api: MockApi;
  let user: UserEvent;

  beforeEach(() => {
    setMockSearch("");
    api = installMockApi();
    user = userEvent.setup();
  });

  describe("draft and apply", () => {
    it("does not fetch while the draft changes, then applies everything at once", async () => {
      setMockSearch("page=3");
      renderCustomersView();
      await expectRowsFor(api, { ...defaults, page: 3 });
      const requestsBefore = api.listRequests.length;

      await openPanel(user);
      const applyButton = panel().getByRole("button", { name: "Apply filters" });
      expect(applyButton).toBeDisabled();

      await user.click(panel().getByRole("checkbox", { name: "Lead" }));
      await user.click(panel().getByRole("checkbox", { name: "Active" }));
      await tickCompany(user, "Vela Software");
      await user.type(panel().getByLabelText("Email contains"), "a");
      setDate("From", "2025-01-01");

      expect(api.listRequests).toHaveLength(requestsBefore);
      expect(getMockSearch()).toBe("page=3");
      expect(panel().getByText("You have changes that are not applied yet.")).toBeVisible();
      expect(applyButton).toBeEnabled();

      await apply(user);
      const filters = {
        status: ["lead", "active"] as const,
        companies: ["Vela Software"],
        dateFrom: "2025-01-01",
        email: "a",
      };
      await expectRowsFor(api, withFilters({ ...filters, status: [...filters.status] }));

      // One request for the whole change, and back on page 1.
      expect(api.listRequests).toHaveLength(requestsBefore + 1);
      expect(getMockSearch()).toBe(
        "status=lead&status=active&company=Vela+Software&dateField=createdAt&from=2025-01-01&email=a",
      );
    });

    it("discards an unapplied draft when the panel is closed", async () => {
      setMockSearch("status=lead");
      renderCustomersView();
      await expectRowsFor(api, withFilters({ status: ["lead"] }));
      const requestsBefore = api.listRequests.length;

      await openPanel(user);
      expect(panel().getByRole("checkbox", { name: "Lead" })).toBeChecked();
      await user.click(panel().getByRole("checkbox", { name: "Churned" }));
      await user.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      expect(api.listRequests).toHaveLength(requestsBefore);
      expect(getMockSearch()).toBe("status=lead");

      await openPanel(user);
      expect(panel().getByRole("checkbox", { name: "Lead" })).toBeChecked();
      expect(panel().getByRole("checkbox", { name: "Churned" })).not.toBeChecked();
    });

    it("applies with Enter from a text field", async () => {
      renderCustomersView();
      await expectRowsFor(api, defaults);

      await openPanel(user);
      await user.type(panel().getByLabelText("Email contains"), "@vela{Enter}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await expectRowsFor(api, withFilters({ email: "@vela" }));
    });
  });

  describe("individual filters", () => {
    beforeEach(async () => {
      renderCustomersView();
      await expectRowsFor(api, defaults);
      await openPanel(user);
    });

    it("status", async () => {
      await user.click(panel().getByRole("checkbox", { name: "Churned" }));
      await apply(user);

      const expected = await expectRowsFor(api, withFilters({ status: ["churned"] }));
      expect(expected.total).toBeGreaterThan(0);
      expect(expected.items.every((c) => c.status === "churned")).toBe(true);
      expect(getMockSearch()).toBe("status=churned");
      expect(chips()).toEqual(["Status: Churned"]);
    });

    it("company multi-select, with search inside the list", async () => {
      const group = await panel().findByRole("group", { name: "Companies" });
      expect(within(group).getAllByRole("checkbox")).toHaveLength(18);
      expect(panel().getByText("None selected")).toBeVisible();

      await user.type(panel().getByRole("searchbox", { name: "Search companies" }), "fin");
      const narrowed = within(group).getAllByRole("checkbox");
      expect(narrowed.length).toBeLessThan(18);
      await user.click(within(group).getByRole("checkbox", { name: "Harbor & Finch" }));
      await user.click(within(group).getByRole("checkbox", { name: "Quartz Financial" }));
      expect(panel().getByText("2 selected")).toBeVisible();

      await apply(user);
      const companies = ["Harbor & Finch", "Quartz Financial"];
      const expected = await expectRowsFor(api, withFilters({ companies }));
      expect(expected.items.every((c) => companies.includes(c.company))).toBe(true);
      const everyMatch = await api.expected({ ...withFilters({ companies }), pageSize: 50 });
      expect(new Set(everyMatch.items.map((c) => c.company)).size).toBe(2);
      expect(api.listRequests.at(-1)?.getAll("company")).toEqual(companies);
      expect(chips()).toEqual(["Company: Harbor & Finch, Quartz Financial"]);
      expect(filtersButton()).toHaveAccessibleName("Filters, 1 active");
    });

    it("clears the company selection", async () => {
      await tickCompany(user, "Vela Software");
      await tickCompany(user, "Atlas Freight");
      await user.click(panel().getByRole("button", { name: "Clear selected companies" }));
      expect(panel().getByText("None selected")).toBeVisible();
      expect(panel().getByRole("button", { name: "Apply filters" })).toBeDisabled();
    });

    it("date range with both ends", async () => {
      const from = api.customers[20].createdAt.slice(0, 10);
      const to = new Date().toISOString().slice(0, 10);
      setDate("From", from);
      setDate("To", to);
      await apply(user);

      const expected = await expectRowsFor(api, withFilters({ dateFrom: from, dateTo: to }));
      expect(expected.total).toBeGreaterThan(0);
      expect(expected.total).toBeLessThan(150);
      expect(getMockSearch()).toBe(`dateField=createdAt&from=${from}&to=${to}`);
    });

    it("date range with only a start, on the last-contact date", async () => {
      await user.click(panel().getByRole("combobox", { name: "Applies to" }));
      await user.click(await screen.findByRole("option", { name: "Last contact date" }));
      const from = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
      setDate("From", from);
      await apply(user);

      const filters = { dateField: "lastContactedAt" as const, dateFrom: from };
      const expected = await expectRowsFor(api, withFilters(filters));
      expect(expected.total).toBeGreaterThan(0);
      expect(
        expected.items.every((c) => c.lastContactedAt && c.lastContactedAt.slice(0, 10) >= from),
      ).toBe(true);
      expect(getMockSearch()).toBe(`dateField=lastContactedAt&from=${from}`);
      expect(chips()[0]).toMatch(/^Last contact: from /);
    });

    it("date range with only an end", async () => {
      const to = api.customers[20].createdAt.slice(0, 10);
      setDate("To", to);
      await apply(user);

      const expected = await expectRowsFor(api, withFilters({ dateTo: to }));
      expect(expected.total).toBeGreaterThan(0);
      expect(getMockSearch()).toBe(`dateField=createdAt&to=${to}`);
      expect(chips()[0]).toMatch(/^Created: until /);
    });

    it("refuses a reversed date range", async () => {
      setDate("From", "2026-05-01");
      setDate("To", "2026-01-01");

      expect(panel().getByRole("alert")).toHaveTextContent(
        "The end date must be on or after the start date.",
      );
      expect(panel().getByRole("button", { name: "Apply filters" })).toBeDisabled();

      await user.click(panel().getByLabelText("Email contains"));
      await user.keyboard("{Enter}");
      expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
      expect(getMockSearch()).toBe("");

      setDate("To", "2026-06-01");
      expect(panel().queryByRole("alert")).toBeNull();
      expect(panel().getByRole("button", { name: "Apply filters" })).toBeEnabled();

      await user.click(panel().getByRole("button", { name: "Clear dates" }));
      expect(panel().getByLabelText("From")).toHaveValue("");
      expect(panel().getByLabelText("To")).toHaveValue("");
    });

    it("partial email", async () => {
      await user.type(panel().getByLabelText("Email contains"), "@VELA");
      await apply(user);

      const expected = await expectRowsFor(api, withFilters({ email: "@VELA" }));
      expect(expected.total).toBeGreaterThan(0);
      expect(expected.items.every((c) => c.email.includes("@vela"))).toBe(true);
      expect(chips()).toEqual(["Email contains “@VELA”"]);
    });

    it("partial phone, ignoring formatting", async () => {
      await user.type(panel().getByLabelText("Phone contains"), "(415) 555");
      await apply(user);

      const expected = await expectRowsFor(api, withFilters({ phone: "(415) 555" }));
      expect(expected.total).toBeGreaterThan(0);
      expect(
        expected.items.every((c) => c.phone.replace(/\D/g, "").includes("415555")),
      ).toBe(true);
      expect(api.listRequests.at(-1)?.get("phone")).toBe("(415) 555");
    });
  });

  describe("combinations", () => {
    const ALL: CustomerFilters = {
      status: ["prospect", "active"],
      companies: ["Quartz Financial", "Vela Software"],
      dateField: "createdAt",
      dateFrom: "2024-01-01",
      dateTo: null,
      includeNeverContacted: false,
      email: ".example",
      phone: "555",
    };

    it("applies every filter together and shows the active count", async () => {
      renderCustomersView();
      await expectRowsFor(api, defaults);
      expect(filtersButton()).toHaveAccessibleName("Filters");
      expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();

      await openPanel(user);
      await user.click(panel().getByRole("checkbox", { name: "Prospect" }));
      await user.click(panel().getByRole("checkbox", { name: "Active" }));
      await tickCompany(user, "Vela Software");
      await tickCompany(user, "Quartz Financial");
      setDate("From", "2024-01-01");
      await user.type(panel().getByLabelText("Email contains"), ".example");
      await user.type(panel().getByLabelText("Phone contains"), "555");
      await apply(user);

      const expected = await expectRowsFor(api, { ...defaults, filters: ALL });
      expect(expected.total).toBeGreaterThan(0);
      expect(
        expected.items.every(
          (c) => ALL.status.includes(c.status) && ALL.companies.includes(c.company),
        ),
      ).toBe(true);
      expect(filtersButton()).toHaveAccessibleName("Filters, 5 active");
      expect(chips()).toEqual([
        "Status: Prospect, Active",
        "Company: Quartz Financial, Vela Software",
        "Created: from Jan 1, 2024",
        "Email contains “.example”",
        "Phone contains “555”",
      ]);

      await openPanel(user);
      expect(panel().getByText("5 filters applied.")).toBeVisible();
    });

    it("works together with search, sorting, page size and pagination", async () => {
      setMockSearch("q=a&sortBy=name&sortOrder=asc&pageSize=25&page=2");
      renderCustomersView();
      const base = { ...defaults, search: "a", sortBy: "name", sortOrder: "asc", pageSize: 25 } as const;
      await expectRowsFor(api, { ...base, page: 2 });

      // Applying a filter keeps search, sort and page size, and returns to page 1.
      await openPanel(user);
      await user.click(panel().getByRole("checkbox", { name: "Lead" }));
      await user.click(panel().getByRole("checkbox", { name: "Prospect" }));
      await user.click(panel().getByRole("checkbox", { name: "Active" }));
      await apply(user);
      const filters = { ...EMPTY_CUSTOMER_FILTERS, status: ["lead", "prospect", "active"] as CustomerFilters["status"] };
      const page1 = await expectRowsFor(api, { ...base, filters });
      expect(page1.totalPages).toBeGreaterThan(1);
      expect(getMockSearch()).toBe(
        "q=a&status=lead&status=prospect&status=active&sortBy=name&sortOrder=asc&pageSize=25",
      );

      // Paging keeps the filters.
      await user.click(screen.getByRole("button", { name: "Next page" }));
      await expectRowsFor(api, { ...base, filters, page: 2 });
      expect(api.listRequests.at(-1)?.getAll("status")).toEqual(["lead", "prospect", "active"]);

      // Sorting keeps the filters and search.
      const header = screen.getByRole("columnheader", { name: "Company" });
      await user.click(within(header).getByRole("button"));
      await expectRowsFor(api, { ...base, filters, sortBy: "company", sortOrder: "asc" });

      // Searching keeps the filters.
      await user.clear(screen.getByRole("searchbox", { name: "Search customers" }));
      await user.type(screen.getByRole("searchbox", { name: "Search customers" }), "quartz");
      const searched = await expectRowsFor(api, {
        ...base,
        filters,
        search: "quartz",
        sortBy: "company",
      });
      expect(searched.items.every((c) => filters.status.includes(c.status))).toBe(true);
      expect(getMockSearch()).toBe(
        "q=quartz&status=lead&status=prospect&status=active&sortBy=company&sortOrder=asc&pageSize=25",
      );
    });
  });

  describe("clearing", () => {
    beforeEach(async () => {
      setMockSearch("q=a&status=lead&status=active&email=example&sortBy=name&sortOrder=asc&page=2");
      renderCustomersView();
      await screen.findByRole("list", { name: "Active filters" });
    });

    const base = { ...defaults, search: "a", sortBy: "name", sortOrder: "asc" } as const;

    it("Clear filters above the table resets filters but keeps search and sort", async () => {
      await user.click(screen.getByRole("button", { name: "Clear filters" }));

      await expectRowsFor(api, base);
      expect(getMockSearch()).toBe("q=a&sortBy=name&sortOrder=asc");
      expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
      expect(filtersButton()).toHaveAccessibleName("Filters");
    });

    it("Clear all in the panel resets the draft and the applied filters", async () => {
      await openPanel(user);
      await user.click(panel().getByRole("checkbox", { name: "Churned" }));
      await user.click(panel().getByRole("button", { name: "Clear all" }));

      for (const status of ["Lead", "Active", "Churned"]) {
        expect(panel().getByRole("checkbox", { name: status })).not.toBeChecked();
      }
      expect(panel().getByLabelText("Email contains")).toHaveValue("");
      expect(panel().getByText("No filters applied.")).toBeVisible();
      expect(panel().getByRole("button", { name: "Clear all" })).toBeDisabled();
      expect(getMockSearch()).toBe("q=a&sortBy=name&sortOrder=asc");

      await user.click(screen.getByRole("button", { name: "Close" }));
      await expectRowsFor(api, base);
    });

    it("removes a single filter from its chip", async () => {
      expect(chips()).toEqual(["Status: Lead, Active", "Email contains “example”"]);

      await user.click(
        screen.getByRole("button", { name: "Remove filter Email contains “example”" }),
      );
      await expectRowsFor(api, {
        ...base,
        filters: { ...EMPTY_CUSTOMER_FILTERS, status: ["lead", "active"] },
      });
      expect(chips()).toEqual(["Status: Lead, Active"]);
      expect(filtersButton()).toHaveAccessibleName("Filters, 1 active");
      expect(getMockSearch()).toBe("q=a&status=lead&status=active&sortBy=name&sortOrder=asc");
    });
  });

  describe("templates", () => {
    it.each(FILTER_TEMPLATES)("applies “$name”", async (template) => {
      setMockSearch("q=a&page=2");
      renderCustomersView();
      await expectRowsFor(api, { ...defaults, search: "a", page: 2 });

      await openPanel(user);
      await user.click(
        panel().getByRole("button", { name: (name) => name.startsWith(template.name) }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      const filters = template.build(new Date());
      await expectRowsFor(api, { ...defaults, search: "a", filters });

      const request = api.listRequests.at(-1);
      expect(request?.getAll("status")).toEqual(filters.status);
      expect(request?.get("dateField")).toBe(filters.dateField);
      expect(request?.get("from")).toBe(filters.dateFrom);
      expect(request?.get("to")).toBe(filters.dateTo);
      expect(request?.get("never")).toBe(filters.includeNeverContacted ? "1" : null);
      expect(request?.get("page")).toBe("1");
      expect(filtersButton()).toHaveAccessibleName("Filters, 2 active");

      // The template lands in the same draft the form edits.
      await openPanel(user);
      for (const status of filters.status) {
        const label = status[0].toUpperCase() + status.slice(1);
        expect(panel().getByRole("checkbox", { name: label })).toBeChecked();
      }
      expect(panel().getByLabelText("From")).toHaveValue(filters.dateFrom ?? "");
      expect(panel().getByLabelText("To")).toHaveValue(filters.dateTo ?? "");
      if (filters.dateField === "lastContactedAt") {
        const never = panel().getByRole("checkbox", {
          name: "Also include customers never contacted",
        });
        if (filters.includeNeverContacted) expect(never).toBeChecked();
        else expect(never).not.toBeChecked();
      }
    });

    it("can include customers who were never contacted in a last-contact range", async () => {
      renderCustomersView();
      await expectRowsFor(api, defaults);
      const to = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

      await openPanel(user);
      // The option only applies to the last-contact date.
      expect(
        panel().queryByRole("checkbox", { name: "Also include customers never contacted" }),
      ).toBeNull();
      await user.click(panel().getByRole("combobox", { name: "Applies to" }));
      await user.click(await screen.findByRole("option", { name: "Last contact date" }));
      const never = panel().getByRole("checkbox", {
        name: "Also include customers never contacted",
      });
      expect(never).toBeDisabled();
      setDate("To", to);
      await apply(user);

      const base = { dateField: "lastContactedAt" as const, dateTo: to };
      const without = await expectRowsFor(api, withFilters(base));
      expect(without.items.every((c) => c.lastContactedAt !== null)).toBe(true);

      await openPanel(user);
      await user.click(
        panel().getByRole("checkbox", { name: "Also include customers never contacted" }),
      );
      await apply(user);

      const withNever = await expectRowsFor(
        api,
        withFilters({ ...base, includeNeverContacted: true }),
      );
      expect(withNever.total).toBeGreaterThan(without.total);
      expect(getMockSearch()).toBe(`dateField=lastContactedAt&to=${to}&never=1`);
      expect(chips()[0]).toMatch(/^Last contact: until .*, or never$/);
    });
  });

  describe("saved filters", () => {
    const STATUS_FILTER = "status=prospect&email=example";
    const filters = { ...EMPTY_CUSTOMER_FILTERS, status: ["prospect"] as CustomerFilters["status"], email: "example" };

    async function renderWithSavedFilter(name = "Warm prospects") {
      setMockSearch(STATUS_FILTER);
      renderCustomersView();
      await expectRowsFor(api, { ...defaults, filters });
      await saveAppliedAs(user, name);
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Save filter" })).toBeNull(),
      );
    }

    it("shows an empty message before anything is saved", async () => {
      renderCustomersView();
      await expectRowsFor(api, defaults);
      await openPanel(user);
      expect(await panel().findByText(/No saved filters yet/)).toBeVisible();
      // Saving is only offered when filters are applied.
      expect(screen.queryByRole("button", { name: "Save filter" })).toBeNull();
    });

    it("saves the applied filters under a name", async () => {
      await renderWithSavedFilter();

      expect(await api.savedFilters()).toHaveLength(1);
      expect((await api.savedFilters())[0]).toMatchObject({ name: "Warm prospects", filters });

      await openPanel(user);
      const list = await panel().findByRole("list", { name: "Saved filters" });
      expect(within(list).getByText("Warm prospects")).toBeVisible();
      expect(within(list).getByText("Status: Prospect · Email contains “example”")).toBeVisible();
    });

    it("validates the name and reports a duplicate inline", async () => {
      await renderWithSavedFilter();

      await user.click(screen.getByRole("button", { name: "Save filter" }));
      const dialog = within(screen.getByRole("dialog", { name: "Save filter" }));
      await user.click(dialog.getByRole("button", { name: "Save" }));
      expect(dialog.getByRole("alert")).toHaveTextContent("Name is required");
      expect(dialog.getByLabelText("Name")).toBeInvalid();

      await user.type(dialog.getByLabelText("Name"), "warm PROSPECTS");
      expect(dialog.queryByRole("alert")).toBeNull();
      await user.click(dialog.getByRole("button", { name: "Save" }));
      expect(await dialog.findByRole("alert")).toHaveTextContent(
        "A saved filter with this name already exists",
      );
      expect(await api.savedFilters()).toHaveLength(1);

      await user.clear(dialog.getByLabelText("Name"));
      await user.type(dialog.getByLabelText("Name"), "Second view");
      await user.click(dialog.getByRole("button", { name: "Save" }));
      await waitFor(async () => expect(await api.savedFilters()).toHaveLength(2));
    });

    it("loads a saved filter", async () => {
      await renderWithSavedFilter();
      await user.click(screen.getByRole("button", { name: "Clear filters" }));
      await expectRowsFor(api, defaults);

      await openPanel(user);
      await user.click(await panel().findByRole("button", { name: /^Warm prospects/ }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      await expectRowsFor(api, { ...defaults, filters });
      expect(getMockSearch()).toBe(STATUS_FILTER);
      expect(chips()).toEqual(["Status: Prospect", "Email contains “example”"]);
    });

    it("renames a saved filter", async () => {
      await renderWithSavedFilter();
      const requestsBefore = api.listRequests.length;

      await openPanel(user);
      await user.click(await panel().findByRole("button", { name: "Rename Warm prospects" }));
      const dialog = within(screen.getByRole("dialog", { name: "Rename saved filter" }));
      const input = dialog.getByLabelText("Name");
      expect(input).toHaveValue("Warm prospects");
      await user.clear(input);
      await user.type(input, "Hot prospects{Enter}");

      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Rename saved filter" })).toBeNull(),
      );
      expect((await api.savedFilters())[0].name).toBe("Hot prospects");
      expect(await panel().findByRole("button", { name: /^Hot prospects/ })).toBeVisible();
      expect(panel().queryByRole("button", { name: /^Warm prospects/ })).toBeNull();
      // Renaming neither closes the panel nor touches the customer list.
      expect(api.listRequests).toHaveLength(requestsBefore);
    });

    it("deletes a saved filter", async () => {
      await renderWithSavedFilter();

      await openPanel(user);
      await user.click(await panel().findByRole("button", { name: "Delete Warm prospects" }));

      expect(await panel().findByText(/No saved filters yet/)).toBeVisible();
      expect(await api.savedFilters()).toHaveLength(0);
      // The applied filters stay as they were.
      expect(getMockSearch()).toBe(STATUS_FILTER);
    });

    it("shows an error with Retry when saved filters fail to load", async () => {
      api.setFailing(true, "saved-filters");
      renderCustomersView();
      await expectRowsFor(api, defaults);

      await openPanel(user);
      const alert = await panel().findByText(/Couldn't load saved filters/);
      expect(alert).toHaveTextContent("Database unavailable");

      api.setFailing(false, "saved-filters");
      await user.click(
        within(alert.closest("[role=alert]") as HTMLElement).getByRole("button", { name: "Retry" }),
      );
      expect(await panel().findByText(/No saved filters yet/)).toBeVisible();
    });

    it("shows an error with Retry when companies fail to load", async () => {
      api.setFailing(true, "companies");
      renderCustomersView();
      await expectRowsFor(api, defaults);

      await openPanel(user);
      const alert = await panel().findByText(/Couldn't load companies/);
      // The rest of the form still works.
      expect(panel().getByRole("checkbox", { name: "Lead" })).toBeEnabled();

      api.setFailing(false, "companies");
      await user.click(
        within(alert.closest("[role=alert]") as HTMLElement).getByRole("button", { name: "Retry" }),
      );
      expect(await panel().findByRole("group", { name: "Companies" })).toBeVisible();
    });
  });

  describe("URL state", () => {
    const QUERY =
      "q=a&status=lead&status=active&company=Harbor+%26+Finch&company=Vela+Software" +
      "&dateField=lastContactedAt&from=2025-01-01&to=2026-12-31&email=example&phone=555" +
      "&sortBy=name&sortOrder=desc&pageSize=25";
    const FILTERS: CustomerFilters = {
      status: ["lead", "active"],
      companies: ["Harbor & Finch", "Vela Software"],
      dateField: "lastContactedAt",
      dateFrom: "2025-01-01",
      dateTo: "2026-12-31",
      includeNeverContacted: false,
      email: "example",
      phone: "555",
    };

    it("restores applied filters from the URL after a reload", async () => {
      setMockSearch(QUERY);
      renderCustomersView();

      await expectRowsFor(api, {
        search: "a",
        filters: FILTERS,
        sortBy: "name",
        sortOrder: "desc",
        page: 1,
        pageSize: 25,
      });
      expect(filtersButton()).toHaveAccessibleName("Filters, 5 active");
      expect(chips()).toEqual([
        "Status: Lead, Active",
        "Company: Harbor & Finch, Vela Software",
        "Last contact: Jan 1, 2025 – Dec 31, 2026",
        "Email contains “example”",
        "Phone contains “555”",
      ]);

      // The panel's draft starts from the restored filters.
      await openPanel(user);
      expect(panel().getByRole("checkbox", { name: "Lead" })).toBeChecked();
      expect(panel().getByRole("checkbox", { name: "Prospect" })).not.toBeChecked();
      const group = await panel().findByRole("group", { name: "Companies" });
      expect(within(group).getByRole("checkbox", { name: "Harbor & Finch" })).toBeChecked();
      expect(panel().getByText("2 selected")).toBeVisible();
      expect(panel().getByRole("combobox", { name: "Applies to" })).toHaveTextContent("Last contact date");
      expect(panel().getByLabelText("From")).toHaveValue("2025-01-01");
      expect(panel().getByLabelText("To")).toHaveValue("2026-12-31");
      expect(panel().getByLabelText("Email contains")).toHaveValue("example");
      expect(panel().getByLabelText("Phone contains")).toHaveValue("555");
      expect(panel().getByRole("button", { name: "Apply filters" })).toBeDisabled();
    });

    it("keeps empty values out of the URL", async () => {
      renderCustomersView();
      await expectRowsFor(api, defaults);

      await openPanel(user);
      await user.click(panel().getByRole("combobox", { name: "Applies to" }));
      await user.click(await screen.findByRole("option", { name: "Last contact date" }));
      await user.type(panel().getByLabelText("Email contains"), "   ");
      // A date field with no dates and a blank email are not filters.
      expect(panel().getByRole("button", { name: "Apply filters" })).toBeDisabled();

      await user.click(panel().getByRole("checkbox", { name: "Lead" }));
      await apply(user);
      expect(getMockSearch()).toBe("status=lead");
    });

    it("follows browser back and forward", async () => {
      renderCustomersView();
      await expectRowsFor(api, defaults);

      await openPanel(user);
      await user.click(panel().getByRole("checkbox", { name: "Lead" }));
      await apply(user);
      const leads = await expectRowsFor(api, withFilters({ status: ["lead"] }));

      await openPanel(user);
      await user.type(panel().getByLabelText("Email contains"), "example");
      await tickCompany(user, "Vela Software");
      await apply(user);
      const narrowed = withFilters({
        status: ["lead"],
        companies: ["Vela Software"],
        email: "example",
      });
      await expectRowsFor(api, narrowed);
      expect(filtersButton()).toHaveAccessibleName("Filters, 3 active");

      mockBack();
      await expectRowsFor(api, withFilters({ status: ["lead"] }));
      expect(rowNames()).toEqual(leads.items.map((c) => c.name));
      expect(chips()).toEqual(["Status: Lead"]);

      mockBack();
      await expectRowsFor(api, defaults);
      expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
      expect(filtersButton()).toHaveAccessibleName("Filters");

      mockForward();
      mockForward();
      await expectRowsFor(api, narrowed);
      expect(filtersButton()).toHaveAccessibleName("Filters, 3 active");
    });
  });

  describe("empty and error states", () => {
    it("shows an empty state for filters that match nothing, and can clear them", async () => {
      setMockSearch("company=Vela+Software&email=%40quartzfinancial");
      renderCustomersView();

      expect(await screen.findByText("No customers found")).toBeInTheDocument();
      expect(
        screen.getByText("No customers match the current filters. Try removing some of them."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();

      await user.click(screen.getByRole("button", { name: "Clear all filters" }));
      await expectRowsFor(api, defaults);
      expect(getMockSearch()).toBe("");
    });

    it("offers to clear search and filters separately when both are set", async () => {
      setMockSearch("q=zzzz&status=lead");
      renderCustomersView();

      expect(
        await screen.findByText("Nothing matches “zzzz” with the current filters."),
      ).toBeInTheDocument();
      // The search box has its own clear button; the empty state's comes last.
      const clearButtons = screen.getAllByRole("button", { name: "Clear search" });
      await user.click(clearButtons[clearButtons.length - 1]);
      await expectRowsFor(api, withFilters({ status: ["lead"] }));
      expect(getMockSearch()).toBe("status=lead");
    });

    it("shows an error for a filtered request and recovers on Retry", async () => {
      renderCustomersView();
      await expectRowsFor(api, defaults);

      api.setFailing(true);
      await openPanel(user);
      await user.click(panel().getByRole("checkbox", { name: "Active" }));
      await apply(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Couldn't load customers");
      // The filter stays applied and visible while the request is failing.
      expect(chips()).toEqual(["Status: Active"]);
      expect(getMockSearch()).toBe("status=active");

      api.setFailing(false);
      await user.click(within(alert).getByRole("button", { name: "Retry" }));
      await expectRowsFor(api, withFilters({ status: ["active"] }));
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("keeps the previous rows visible while a filtered result loads", async () => {
      renderCustomersView();
      const before = await expectRowsFor(api, defaults);

      await openPanel(user);
      await user.click(panel().getByRole("checkbox", { name: "Inactive" }));
      api.pause();
      await apply(user);

      await waitFor(() =>
        expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true"),
      );
      expect(rowNames()).toEqual(before.items.map((c) => c.name));

      api.resume();
      await expectRowsFor(api, withFilters({ status: ["inactive"] }));
    });
  });
});
