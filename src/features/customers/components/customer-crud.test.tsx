import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatDate, toDateTimeLocalValue } from "@/lib/format";
import { installMockApi } from "@/test/mock-api";
import { getMockSearch, setMockSearch } from "@/test/navigation-mock";

import { DEFAULT_CUSTOMER_LIST_PARAMS, type Customer } from "../types";
import {
  dataRows,
  expectRowsFor,
  renderCustomersView,
  rowNames,
  type MockApi,
} from "./test-utils";

vi.mock("next/navigation", () => import("@/test/navigation-mock"));

const defaults = DEFAULT_CUSTOMER_LIST_PARAMS;

const NEW_CUSTOMER = {
  name: "Zadie Okonkwo",
  email: "zadie.okonkwo@newco.example",
  phone: "+44 20 7946 0958",
  company: "NewCo Ventures",
  jobTitle: "Head of Partnerships",
};

const isDetailRequest = (method: string, path: string) =>
  method === "GET" && /^\/api\/customers\/cus_[^/]+$/.test(path);
const isNotesRequest = (method: string, path: string) =>
  method === "GET" && path.endsWith("/notes");
const isMutation = (method: string) => method !== "GET";

describe("customer CRUD, details, contact and notes", () => {
  let api: MockApi;
  let user: UserEvent;
  /** The first row of the default list. */
  let first: Customer;

  beforeEach(async () => {
    toast.dismiss();
    setMockSearch("");
    api = installMockApi();
    user = userEvent.setup();
    first = (await api.expected(defaults)).items[0];
  });

  async function renderLoaded(params = defaults) {
    renderCustomersView();
    return expectRowsFor(api, params);
  }

  async function chooseRowAction(customer: Customer, action: string) {
    await user.click(screen.getByRole("button", { name: `Actions for ${customer.name}` }));
    await user.click(await screen.findByRole("menuitem", { name: action }));
  }

  async function openDetails(customer: Customer) {
    await user.click(screen.getByRole("button", { name: customer.name }));
    return within(await screen.findByRole("dialog", { name: customer.name }));
  }

  const formDialog = (title: string) => within(screen.getByRole("dialog", { name: title }));
  const requestCount = (prefix: string) =>
    api.requests.filter((request) => request.startsWith(prefix)).length;

  async function fillCustomerForm(
    dialog: ReturnType<typeof within>,
    values: Partial<typeof NEW_CUSTOMER>,
  ) {
    const fields: [RegExp, string | undefined][] = [
      [/Full name/, values.name],
      [/Email/, values.email],
      [/Phone/, values.phone],
      [/Company/, values.company],
      [/Job title/, values.jobTitle],
    ];
    for (const [label, value] of fields) {
      if (value === undefined) continue;
      const input = dialog.getByLabelText(label);
      await user.clear(input);
      if (value) await user.type(input, value);
    }
  }

  async function chooseOption(dialog: ReturnType<typeof within>, label: RegExp, option: string) {
    await user.click(dialog.getByRole("combobox", { name: label }));
    await user.click(await screen.findByRole("option", { name: option }));
  }

  describe("details drawer", () => {
    it("opens from the customer name, shows a loading state, then every field", async () => {
      await renderLoaded();

      api.pause(isDetailRequest);
      await user.click(screen.getByRole("button", { name: first.name }));
      const loading = within(await screen.findByRole("dialog"));
      expect(loading.getByLabelText("Loading customer")).toBeInTheDocument();
      expect(loading.queryByRole("button", { name: "Edit" })).toBeNull();

      api.resume();
      const drawer = within(await screen.findByRole("dialog", { name: first.name }));
      const details = within(drawer.getByLabelText("Customer details"));
      expect(details.getByRole("link", { name: first.email })).toHaveAttribute(
        "href",
        `mailto:${first.email}`,
      );
      expect(details.getByRole("link", { name: first.phone })).toHaveAttribute(
        "href",
        `tel:${first.phone}`,
      );
      expect(details.getByText(first.company)).toBeInTheDocument();
      expect(details.getByText(first.jobTitle)).toBeInTheDocument();
      expect(details.getByText(new RegExp(`^${first.status}$`, "i"))).toBeInTheDocument();
      expect(details.getByText(formatDate(first.createdAt))).toBeInTheDocument();
      expect(drawer.getByRole("heading", { name: /^Notes/ })).toBeInTheDocument();
      expect(drawer.queryByLabelText("Loading customer")).toBeNull();
    });

    it("opens from the row menu and shows last-contact details", async () => {
      const contacted = await api.repository.logContact(first.id, {
        method: "meeting",
        contactedAt: "2026-03-04T10:15:00.000Z",
      });
      await renderLoaded();

      await chooseRowAction(first, "View details");
      const drawer = within(await screen.findByRole("dialog", { name: first.name }));
      const details = within(drawer.getByLabelText("Customer details"));
      expect(details.getByText(/Mar 4, 2026/)).toBeInTheDocument();
      expect(details.getByText("Meeting")).toBeInTheDocument();
      expect(contacted.lastContactMethod).toBe("meeting");
    });

    it("shows placeholders for a customer who was never contacted", async () => {
      const created = await api.repository.create({
        ...NEW_CUSTOMER,
        jobTitle: "",
        status: "lead",
      });
      await renderLoaded();

      const drawer = await openDetails(created);
      expect(drawer.getByText("Never contacted")).toBeInTheDocument();
      expect(drawer.getByText("None yet")).toBeInTheDocument();
      expect(drawer.getByText("Not set")).toBeInTheDocument();
      expect(await drawer.findByText("No notes yet.")).toBeInTheDocument();
    });

    it("shows an error with Retry, and recovers", async () => {
      await renderLoaded();

      const restore = api.failWhen(isDetailRequest);
      await user.click(screen.getByRole("button", { name: first.name }));
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Couldn't load this customer");
      expect(alert).toHaveTextContent("Database unavailable");

      restore();
      await user.click(within(alert).getByRole("button", { name: "Retry" }));
      const drawer = within(await screen.findByRole("dialog", { name: first.name }));
      expect(drawer.getByRole("link", { name: first.email })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("serves a reopened customer from the cache", async () => {
      await renderLoaded();

      await openDetails(first);
      await user.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(requestCount(`GET /api/customers/${first.id}`)).toBe(2); // customer + notes

      const drawer = await openDetails(first);
      expect(drawer.queryByLabelText("Loading customer")).toBeNull();
      expect(requestCount(`GET /api/customers/${first.id}`)).toBe(2);
    });
  });

  describe("add customer", () => {
    it("shows inline validation errors and sends nothing", async () => {
      await renderLoaded();

      await user.click(screen.getByRole("button", { name: "Add customer" }));
      const dialog = formDialog("Add customer");
      await user.click(dialog.getByRole("button", { name: "Add customer" }));

      expect(await dialog.findByText("Name must be at least 2 characters")).toBeVisible();
      expect(dialog.getByText("Email is required")).toBeVisible();
      expect(dialog.getByText("Phone is required")).toBeVisible();
      expect(dialog.getByText("Company is required")).toBeVisible();
      expect(dialog.getByLabelText(/Full name/)).toBeInvalid();
      expect(dialog.getByLabelText(/Full name/)).toHaveAccessibleDescription(
        "Name must be at least 2 characters",
      );
      expect(dialog.getByLabelText(/Job title/)).toBeValid();

      await fillCustomerForm(dialog, { name: "Zadie", email: "not-an-email", phone: "12ab" });
      await user.click(dialog.getByRole("button", { name: "Add customer" }));
      expect(await dialog.findByText("Enter a valid email address")).toBeVisible();
      expect(dialog.getByText("Use digits, spaces and + ( ) - . only")).toBeVisible();
      expect(dialog.queryByText("Name must be at least 2 characters")).toBeNull();

      await fillCustomerForm(dialog, { phone: "12345" });
      await user.click(dialog.getByRole("button", { name: "Add customer" }));
      expect(await dialog.findByText("Phone number must contain 7 to 15 digits")).toBeVisible();

      expect(requestCount("POST")).toBe(0);
      expect(await api.allCustomers()).toHaveLength(150);
    });

    it("creates a customer, disabling submit while pending, then refreshes the list", async () => {
      await renderLoaded();
      const listRequestsBefore = api.listRequests.length;

      await user.click(screen.getByRole("button", { name: "Add customer" }));
      const dialog = formDialog("Add customer");
      expect(dialog.getByRole("combobox", { name: /Status/ })).toHaveTextContent("Lead");
      await fillCustomerForm(dialog, NEW_CUSTOMER);
      await chooseOption(dialog, /Status/, "Prospect");

      api.pause(isMutation);
      await user.click(dialog.getByRole("button", { name: "Add customer" }));
      const pending = await dialog.findByRole("button", { name: "Adding…" });
      expect(pending).toBeDisabled();
      expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
      // A second submit while pending is ignored.
      fireEvent.submit(pending.closest("form") as HTMLFormElement);

      api.resume();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(await screen.findByText(`Added ${NEW_CUSTOMER.name}`)).toBeInTheDocument();
      expect(requestCount("POST /api/customers")).toBe(1);

      // The list was invalidated and the new customer arrives through it.
      await expectRowsFor(api, defaults);
      expect(api.listRequests.length).toBeGreaterThan(listRequestsBefore);
      expect(rowNames()[0]).toBe(NEW_CUSTOMER.name);
      const row = within(dataRows()[0]);
      expect(row.getByText(NEW_CUSTOMER.phone)).toBeInTheDocument();
      expect(row.getByText("Prospect")).toBeInTheDocument();
      expect(row.getByText("Never")).toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: "Pagination" })).toHaveTextContent(
        "of 151 customers",
      );

      const stored = (await api.allCustomers()).find((c) => c.email === NEW_CUSTOMER.email);
      expect(stored).toMatchObject({ ...NEW_CUSTOMER, status: "prospect" });
    });

    it("offers to view the new customer from the toast", async () => {
      // With this search applied the new customer is not in the visible rows.
      setMockSearch("q=quartz");
      await renderLoaded({ ...defaults, search: "quartz" });

      await user.click(screen.getByRole("button", { name: "Add customer" }));
      const dialog = formDialog("Add customer");
      await fillCustomerForm(dialog, NEW_CUSTOMER);
      await user.click(dialog.getByRole("button", { name: "Add customer" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      expect(rowNames()).not.toContain(NEW_CUSTOMER.name);
      expect(getMockSearch()).toBe("q=quartz");
      await user.click(await screen.findByRole("button", { name: "View" }));
      const drawer = within(await screen.findByRole("dialog", { name: NEW_CUSTOMER.name }));
      expect(await drawer.findByRole("link", { name: NEW_CUSTOMER.email })).toBeInTheDocument();
    });

    it("shows an API validation error under its field and keeps the dialog open", async () => {
      await renderLoaded();

      await user.click(screen.getByRole("button", { name: "Add customer" }));
      const dialog = formDialog("Add customer");
      await fillCustomerForm(dialog, { ...NEW_CUSTOMER, email: first.email.toUpperCase() });
      await user.click(dialog.getByRole("button", { name: "Add customer" }));

      const message = "A customer with this email already exists";
      expect(await dialog.findByText(message)).toBeVisible();
      expect(dialog.getByLabelText(/Email/)).toBeInvalid();
      expect(dialog.getByLabelText(/Email/)).toHaveFocus();
      expect(await screen.findByText("Couldn't add the customer")).toBeInTheDocument();
      expect(dialog.getByRole("button", { name: "Add customer" })).toBeEnabled();
      expect(await api.allCustomers()).toHaveLength(150);

      // Fixing the field and resubmitting succeeds.
      await fillCustomerForm(dialog, { email: NEW_CUSTOMER.email });
      await user.click(dialog.getByRole("button", { name: "Add customer" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(await api.allCustomers()).toHaveLength(151);
    });

    it("shows a server failure as a form-level error", async () => {
      await renderLoaded();
      api.failWhen(isMutation);

      await user.click(screen.getByRole("button", { name: "Add customer" }));
      const dialog = formDialog("Add customer");
      await fillCustomerForm(dialog, NEW_CUSTOMER);
      await user.click(dialog.getByRole("button", { name: "Add customer" }));

      expect(await dialog.findByRole("alert")).toHaveTextContent("Database unavailable");
      expect(dialog.getByLabelText(/Full name/)).toHaveValue(NEW_CUSTOMER.name);
    });
  });

  describe("edit customer", () => {
    it("pre-fills the form with the customer's current values", async () => {
      await renderLoaded();

      await chooseRowAction(first, "Edit");
      const dialog = formDialog("Edit customer");
      expect(await dialog.findByLabelText(/Full name/)).toHaveValue(first.name);
      expect(dialog.getByLabelText(/Email/)).toHaveValue(first.email);
      expect(dialog.getByLabelText(/Phone/)).toHaveValue(first.phone);
      expect(dialog.getByLabelText(/Company/)).toHaveValue(first.company);
      expect(dialog.getByLabelText(/Job title/)).toHaveValue(first.jobTitle);
      expect(dialog.getByRole("combobox", { name: /Status/ })).toHaveTextContent(
        new RegExp(first.status, "i"),
      );
    });

    it("validates before saving", async () => {
      await renderLoaded();

      await chooseRowAction(first, "Edit");
      const dialog = formDialog("Edit customer");
      await fillCustomerForm(dialog, { name: "", phone: "abc" });
      await dialog.findByLabelText(/Full name/);
      await user.click(dialog.getByRole("button", { name: "Save changes" }));

      expect(await dialog.findByText("Name must be at least 2 characters")).toBeVisible();
      expect(dialog.getByText("Use digits, spaces and + ( ) - . only")).toBeVisible();
      expect(requestCount("PATCH")).toBe(0);
    });

    it("saves changes, keeps the list state and refreshes list and detail", async () => {
      const query = "q=a&status=lead&status=prospect&status=active&sortBy=name&sortOrder=asc&page=2";
      const params = {
        ...defaults,
        search: "a",
        filters: { ...defaults.filters, status: ["lead", "prospect", "active"] as Customer["status"][] },
        sortBy: "name",
        sortOrder: "asc",
        page: 2,
      } as const;
      setMockSearch(query);
      const page = await renderLoaded(params);
      const target = page.items[3];

      await chooseRowAction(target, "Edit");
      const dialog = formDialog("Edit customer");
      await dialog.findByLabelText(/Full name/);
      await fillCustomerForm(dialog, { jobTitle: "Chief Data Officer", phone: "+1 (212) 555-0000" });

      api.pause(isMutation);
      await user.click(dialog.getByRole("button", { name: "Save changes" }));
      expect(await dialog.findByRole("button", { name: "Saving…" })).toBeDisabled();
      api.resume();

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(await screen.findByText(`Saved changes to ${target.name}`)).toBeInTheDocument();
      expect(getMockSearch()).toBe(query);
      await expectRowsFor(api, params);
      expect(requestCount(`PATCH /api/customers/${target.id}`)).toBe(1);
      expect(await api.repository.get(target.id)).toMatchObject({
        name: target.name,
        jobTitle: "Chief Data Officer",
        phone: "+1 (212) 555-0000",
      });

      // The detail cache was updated by the mutation: no extra detail request.
      const detailRequests = () =>
        api.requests.filter((r) => r === `GET /api/customers/${target.id}`).length;
      const before = detailRequests();
      const drawer = await openDetails(target);
      expect(drawer.getByText("Chief Data Officer", { selector: "dd" })).toBeInTheDocument();
      expect(drawer.getByRole("link", { name: "+1 (212) 555-0000" })).toBeInTheDocument();
      expect(detailRequests()).toBe(before);
    });

    it("moves the row when an edit changes how it filters", async () => {
      setMockSearch("status=lead");
      const params = {
        ...defaults,
        filters: { ...defaults.filters, status: ["lead"] as Customer["status"][] },
      };
      const page = await renderLoaded(params);
      const target = page.items[0];

      await chooseRowAction(target, "Edit");
      const dialog = formDialog("Edit customer");
      await dialog.findByLabelText(/Full name/);
      await chooseOption(dialog, /Status/, "Active");
      await user.click(dialog.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      await expectRowsFor(api, params);
      expect(rowNames()).not.toContain(target.name);
      expect(getMockSearch()).toBe("status=lead");
    });

    it("reports an API error and lets the user try again", async () => {
      await renderLoaded();
      const second = (await api.expected(defaults)).items[1];

      await chooseRowAction(first, "Edit");
      const dialog = formDialog("Edit customer");
      await dialog.findByLabelText(/Full name/);

      await fillCustomerForm(dialog, { email: second.email });
      await user.click(dialog.getByRole("button", { name: "Save changes" }));
      expect(await dialog.findByText("A customer with this email already exists")).toBeVisible();
      expect(await screen.findByText("Couldn't save the changes")).toBeInTheDocument();

      const restore = api.failWhen(isMutation);
      await fillCustomerForm(dialog, { email: first.email, name: "Renamed Person" });
      await user.click(dialog.getByRole("button", { name: "Save changes" }));
      expect(await dialog.findByRole("alert")).toHaveTextContent("Database unavailable");
      expect((await api.repository.get(first.id)).name).toBe(first.name);

      restore();
      await user.click(dialog.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect((await api.repository.get(first.id)).name).toBe("Renamed Person");
      await waitFor(() => expect(rowNames()).toContain("Renamed Person"));
    });

    it("shows an error with Retry when the customer can't be loaded", async () => {
      await renderLoaded();
      const restore = api.failWhen(isDetailRequest);

      await chooseRowAction(first, "Edit");
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Couldn't load this customer");

      restore();
      await user.click(within(alert).getByRole("button", { name: "Retry" }));
      expect(await formDialog("Edit customer").findByLabelText(/Full name/)).toHaveValue(first.name);
    });

    it("updates the open details drawer when editing from it", async () => {
      await renderLoaded();

      const drawer = await openDetails(first);
      await user.click(drawer.getByRole("button", { name: "Edit" }));
      const dialog = formDialog("Edit customer");
      await fillCustomerForm(dialog, { name: "Drawer Edited", company: "Brand New Co" });
      await user.click(dialog.getByRole("button", { name: "Save changes" }));

      const updated = within(await screen.findByRole("dialog", { name: "Drawer Edited" }));
      expect(updated.getByText("Brand New Co", { selector: "dd" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(rowNames()).toContain("Drawer Edited"));
    });
  });

  describe("delete customer", () => {
    it("asks for confirmation naming the customer, and cancels cleanly", async () => {
      await renderLoaded();

      await chooseRowAction(first, "Delete");
      const dialog = within(await screen.findByRole("alertdialog", { name: "Delete customer?" }));
      expect(dialog.getByText(first.name)).toBeVisible();
      expect(dialog.getByText(/can't be undone/)).toBeVisible();

      await user.click(dialog.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(requestCount("DELETE")).toBe(0);
      expect(rowNames()).toContain(first.name);
      expect(await api.allCustomers()).toHaveLength(150);
    });

    it("deletes after confirmation, disabling the buttons while pending", async () => {
      await renderLoaded();

      await chooseRowAction(first, "Delete");
      const dialog = within(await screen.findByRole("alertdialog"));
      api.pause(isMutation);
      await user.click(dialog.getByRole("button", { name: "Delete customer" }));

      expect(await dialog.findByRole("button", { name: "Deleting…" })).toBeDisabled();
      expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
      await user.keyboard("{Escape}");
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();

      api.resume();
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(await screen.findByText(`Deleted ${first.name}`)).toBeInTheDocument();
      expect(requestCount(`DELETE /api/customers/${first.id}`)).toBe(1);

      await expectRowsFor(api, defaults);
      expect(rowNames()).not.toContain(first.name);
      expect(dataRows()).toHaveLength(10);
      expect(screen.getByRole("navigation", { name: "Pagination" })).toHaveTextContent(
        "of 149 customers",
      );
    });

    it("keeps the dialog open and the customer intact when the API fails", async () => {
      await renderLoaded();
      const restore = api.failWhen(isMutation);

      await chooseRowAction(first, "Delete");
      const dialog = within(await screen.findByRole("alertdialog"));
      await user.click(dialog.getByRole("button", { name: "Delete customer" }));

      expect(await screen.findByText(`Couldn't delete ${first.name}`)).toBeInTheDocument();
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(dialog.getByRole("button", { name: "Delete customer" })).toBeEnabled();
      expect(await api.allCustomers()).toHaveLength(150);

      restore();
      await user.click(dialog.getByRole("button", { name: "Delete customer" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(await api.allCustomers()).toHaveLength(149);
    });

    it("steps back a page after deleting the only row on the last page", async () => {
      // 151 customers at 10 per page leaves a single row on page 16.
      await api.repository.create({ ...NEW_CUSTOMER, jobTitle: "", status: "lead" });
      setMockSearch("page=16");
      const lastPage = await renderLoaded({ ...defaults, page: 16 });
      expect(lastPage.items).toHaveLength(1);

      await chooseRowAction(lastPage.items[0], "Delete");
      const dialog = within(await screen.findByRole("alertdialog"));
      await user.click(dialog.getByRole("button", { name: "Delete customer" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

      await expectRowsFor(api, { ...defaults, page: 15 });
      expect(dataRows()).toHaveLength(10);
      expect(screen.getByText("Page 15 of 15")).toBeInTheDocument();
      await waitFor(() => expect(getMockSearch()).toBe("page=15"));
    });

    it("closes the details drawer when its customer is deleted", async () => {
      await renderLoaded();

      const drawer = await openDetails(first);
      await user.click(drawer.getByRole("button", { name: "Delete" }));
      const dialog = within(await screen.findByRole("alertdialog"));
      await user.click(dialog.getByRole("button", { name: "Delete customer" }));

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      await waitFor(() => expect(rowNames()).not.toContain(first.name));
    });
  });

  describe("log contact", () => {
    it("requires a method and rejects a future date", async () => {
      await renderLoaded();

      await chooseRowAction(first, "Log contact");
      const dialog = formDialog("Log contact");
      expect(dialog.getByText(new RegExp(`Record a contact with ${first.name}`))).toBeVisible();
      await user.click(dialog.getByRole("button", { name: "Log contact" }));
      expect(await dialog.findByText("Select a contact method")).toBeVisible();

      await chooseOption(dialog, /Method/, "Email");
      const tomorrow = toDateTimeLocalValue(new Date(Date.now() + 864e5));
      fireEvent.change(dialog.getByLabelText(/Date and time/), { target: { value: tomorrow } });
      await user.click(dialog.getByRole("button", { name: "Log contact" }));
      expect(await dialog.findByText("Contact date cannot be in the future")).toBeVisible();
      expect(dialog.queryByText("Select a contact method")).toBeNull();

      fireEvent.change(dialog.getByLabelText(/Date and time/), { target: { value: "" } });
      await user.click(dialog.getByRole("button", { name: "Log contact" }));
      expect(await dialog.findByText("Enter the date and time of the contact")).toBeVisible();
      expect(requestCount("POST")).toBe(0);
    });

    it("logs a contact with a note and refreshes the row", async () => {
      await renderLoaded();
      const notesBefore = (await api.repository.listNotes(first.id)).length;

      await chooseRowAction(first, "Log contact");
      const dialog = formDialog("Log contact");
      await chooseOption(dialog, /Method/, "Meeting");
      await user.type(dialog.getByLabelText("Note"), "Agreed next steps");

      api.pause(isMutation);
      await user.click(dialog.getByRole("button", { name: "Log contact" }));
      expect(await dialog.findByRole("button", { name: "Logging…" })).toBeDisabled();
      expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
      api.resume();

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(await screen.findByText(`Logged meeting with ${first.name}`)).toBeInTheDocument();
      expect(requestCount(`POST /api/customers/${first.id}/contact`)).toBe(1);

      const stored = await api.repository.get(first.id);
      expect(stored.lastContactMethod).toBe("meeting");
      expect(Date.now() - new Date(stored.lastContactedAt ?? 0).getTime()).toBeLessThan(120_000);
      const notes = await api.repository.listNotes(first.id);
      expect(notes).toHaveLength(notesBefore + 1);
      expect(notes[0].body).toBe("Agreed next steps");

      await waitFor(() => {
        const row = within(
          screen.getByRole("button", { name: first.name }).closest("tr") as HTMLElement,
        );
        expect(row.getByText("Meeting")).toBeInTheDocument();
        expect(row.getByText(formatDate(stored.lastContactedAt ?? ""))).toBeInTheDocument();
      });
    });

    it("logs a contact without a note at a chosen time", async () => {
      await renderLoaded();
      const notesBefore = (await api.repository.listNotes(first.id)).length;
      const when = new Date(Date.now() - 3 * 864e5);
      when.setSeconds(0, 0);

      await chooseRowAction(first, "Log contact");
      const dialog = formDialog("Log contact");
      await chooseOption(dialog, /Method/, "Phone call");
      fireEvent.change(dialog.getByLabelText(/Date and time/), {
        target: { value: toDateTimeLocalValue(when) },
      });
      await user.click(dialog.getByRole("button", { name: "Log contact" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      const stored = await api.repository.get(first.id);
      expect(stored.lastContactMethod).toBe("phone");
      expect(stored.lastContactedAt).toBe(when.toISOString());
      expect(await api.repository.listNotes(first.id)).toHaveLength(notesBefore);
    });

    it("reports an API error and keeps the dialog open", async () => {
      await renderLoaded();
      const restore = api.failWhen(isMutation);

      await chooseRowAction(first, "Log contact");
      const dialog = formDialog("Log contact");
      await chooseOption(dialog, /Method/, "Email");
      await user.click(dialog.getByRole("button", { name: "Log contact" }));

      expect(await screen.findByText("Couldn't log the contact")).toBeInTheDocument();
      expect(dialog.getByRole("alert")).toHaveTextContent("Database unavailable");
      expect((await api.repository.get(first.id)).lastContactedAt).toBe(first.lastContactedAt);

      restore();
      await user.click(dialog.getByRole("button", { name: "Log contact" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect((await api.repository.get(first.id)).lastContactMethod).toBe("email");
    });

    it("updates the open details drawer and its notes", async () => {
      await renderLoaded();

      const drawer = await openDetails(first);
      await user.click(drawer.getByRole("button", { name: "Log contact" }));
      const dialog = formDialog("Log contact");
      await chooseOption(dialog, /Method/, "Other");
      await user.type(dialog.getByLabelText("Note"), "Met at the trade show");
      await user.click(dialog.getByRole("button", { name: "Log contact" }));

      const updated = within(await screen.findByRole("dialog", { name: first.name }));
      expect(await updated.findByText("Met at the trade show")).toBeInTheDocument();
      expect(
        within(updated.getByLabelText("Customer details")).getByText("Other"),
      ).toBeInTheDocument();
    });
  });

  describe("notes", () => {
    async function clearNotes() {
      for (const note of await api.repository.listNotes(first.id)) {
        await api.repository.removeNote(first.id, note.id);
      }
    }

    it("shows a loading state, then notes newest first", async () => {
      await clearNotes();
      await api.repository.addNote(first.id, { body: "Older note" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await api.repository.addNote(first.id, { body: "Newer note" });
      await renderLoaded();

      api.pause(isNotesRequest);
      const drawer = await openDetails(first);
      expect(await drawer.findByLabelText("Loading notes")).toBeInTheDocument();

      api.resume();
      const list = within(await drawer.findByRole("list", { name: "Notes" }));
      expect(list.getAllByRole("listitem").map((item) => item.querySelector("p")?.textContent)).toEqual([
        "Newer note",
        "Older note",
      ]);
      expect(drawer.getByRole("heading", { name: "Notes & interactions (2)" })).toBeInTheDocument();
    });

    it("shows an empty state", async () => {
      await clearNotes();
      await renderLoaded();

      const drawer = await openDetails(first);
      expect(await drawer.findByText("No notes yet.")).toBeInTheDocument();
      expect(drawer.queryByRole("list", { name: "Notes" })).toBeNull();
    });

    it("adds a note, with validation and a pending state", async () => {
      await clearNotes();
      await renderLoaded();
      const drawer = await openDetails(first);
      await drawer.findByText("No notes yet.");

      await user.click(drawer.getByRole("button", { name: "Add note" }));
      expect(await drawer.findByRole("alert")).toHaveTextContent("Note cannot be empty");
      expect(requestCount("POST")).toBe(0);

      const input = drawer.getByLabelText("New note");
      await user.type(input, "Prefers email over phone");
      expect(drawer.queryByRole("alert")).toBeNull();

      api.pause(isMutation);
      await user.click(drawer.getByRole("button", { name: "Add note" }));
      expect(await drawer.findByRole("button", { name: "Adding…" })).toBeDisabled();
      api.resume();

      expect(await drawer.findByText("Prefers email over phone", { selector: "p" })).toBeInTheDocument();
      expect(await screen.findByText("Note added")).toBeInTheDocument();
      expect(input).toHaveValue("");
      expect(drawer.getByRole("heading", { name: "Notes & interactions (1)" })).toBeInTheDocument();
      // The notes query was invalidated and refetched.
      expect(requestCount(`GET /api/customers/${first.id}/notes`)).toBe(2);
      expect((await api.repository.listNotes(first.id))[0].body).toBe("Prefers email over phone");
    });

    it("deletes a note after confirmation", async () => {
      await clearNotes();
      await api.repository.addNote(first.id, { body: "Keep this one" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await api.repository.addNote(first.id, { body: "Delete this one" });
      await renderLoaded();
      const drawer = await openDetails(first);
      const list = within(await drawer.findByRole("list", { name: "Notes" }));

      // Cancel leaves it alone.
      await user.click(list.getAllByRole("button", { name: /^Delete note from/ })[0]);
      let dialog = within(await screen.findByRole("alertdialog", { name: "Delete note?" }));
      await user.click(dialog.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(requestCount("DELETE")).toBe(0);

      const again = within(screen.getByRole("dialog", { name: first.name }));
      await user.click(again.getAllByRole("button", { name: /^Delete note from/ })[0]);
      dialog = within(await screen.findByRole("alertdialog", { name: "Delete note?" }));
      api.pause(isMutation);
      await user.click(dialog.getByRole("button", { name: "Delete note" }));
      expect(await dialog.findByRole("button", { name: "Deleting…" })).toBeDisabled();
      api.resume();

      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(await screen.findByText("Note deleted")).toBeInTheDocument();
      const after = within(screen.getByRole("dialog", { name: first.name }));
      await waitFor(() => expect(after.queryByText("Delete this one")).toBeNull());
      expect(after.getByText("Keep this one")).toBeInTheDocument();
      expect((await api.repository.listNotes(first.id)).map((n) => n.body)).toEqual(["Keep this one"]);
    });

    it("shows an error with Retry when notes fail to load", async () => {
      await clearNotes();
      await renderLoaded();
      const restore = api.failWhen(isNotesRequest);

      const drawer = await openDetails(first);
      const alert = await drawer.findByRole("alert");
      expect(alert).toHaveTextContent("Couldn't load notes");
      // The customer's details still loaded.
      expect(drawer.getByRole("link", { name: first.email })).toBeInTheDocument();

      restore();
      await user.click(within(alert).getByRole("button", { name: "Retry" }));
      expect(await drawer.findByText("No notes yet.")).toBeInTheDocument();
    });

    it("reports failures to add or delete a note", async () => {
      await clearNotes();
      await api.repository.addNote(first.id, { body: "Existing note" });
      await renderLoaded();
      const drawer = await openDetails(first);
      await drawer.findByText("Existing note");
      api.failWhen(isMutation);

      await user.type(drawer.getByLabelText("New note"), "Will not save");
      await user.click(drawer.getByRole("button", { name: "Add note" }));
      expect(await screen.findByText("Couldn't add the note")).toBeInTheDocument();
      expect(drawer.getByRole("alert")).toHaveTextContent("Database unavailable");
      expect(drawer.getByLabelText("New note")).toHaveValue("Will not save");

      await user.click(drawer.getByRole("button", { name: /^Delete note from/ }));
      const dialog = within(await screen.findByRole("alertdialog"));
      await user.click(dialog.getByRole("button", { name: "Delete note" }));
      expect(await screen.findByText("Couldn't delete the note")).toBeInTheDocument();
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(await api.repository.listNotes(first.id)).toHaveLength(1);
    });
  });

  describe("row menu", () => {
    it("still copies the email address and links to the mail client", async () => {
      await renderLoaded();

      await chooseRowAction(first, "Copy email");
      expect(await screen.findByText("Email address copied")).toBeInTheDocument();
      expect(await navigator.clipboard.readText()).toBe(first.email);

      await user.click(screen.getByRole("button", { name: `Actions for ${first.name}` }));
      expect(await screen.findByRole("menuitem", { name: "Send email" })).toHaveAttribute(
        "href",
        `mailto:${first.email}`,
      );
    });
  });

  describe("keyboard shortcut", () => {
    it("opens the add dialog with N", async () => {
      await renderLoaded();

      await user.keyboard("n");
      expect(await screen.findByRole("dialog", { name: "Add customer" })).toBeInTheDocument();
      // The keystroke opened the dialog rather than typing into it.
      expect(formDialog("Add customer").getByLabelText(/Full name/)).toHaveValue("");
    });

    it("also responds to Shift+N but not to Ctrl+N", async () => {
      await renderLoaded();

      await user.keyboard("{Control>}n{/Control}");
      expect(screen.queryByRole("dialog")).toBeNull();
      await user.keyboard("N");
      expect(await screen.findByRole("dialog", { name: "Add customer" })).toBeInTheDocument();
    });

    it("does nothing while typing in a field", async () => {
      await renderLoaded();

      await user.type(screen.getByRole("searchbox", { name: "Search customers" }), "nn");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByRole("searchbox", { name: "Search customers" })).toHaveValue("nn");
    });

    it("does nothing while another dialog is open", async () => {
      await renderLoaded();

      await openDetails(first);
      await user.keyboard("n");
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(screen.queryByRole("dialog", { name: "Add customer" })).toBeNull();

      // Typing "n" inside a form field in a dialog is just typing.
      await user.type(
        within(screen.getByRole("dialog")).getByLabelText("New note"),
        "new note",
      );
      expect(within(screen.getByRole("dialog")).getByLabelText("New note")).toHaveValue("new note");
    });
  });

  describe("existing list features after changes", () => {
    it("keeps search, filters, sorting and paging working after CRUD", async () => {
      await renderLoaded();

      // Add, then find the new customer through search.
      await user.click(screen.getByRole("button", { name: "Add customer" }));
      const dialog = formDialog("Add customer");
      await fillCustomerForm(dialog, NEW_CUSTOMER);
      await user.click(dialog.getByRole("button", { name: "Add customer" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      await user.type(screen.getByRole("searchbox", { name: "Search customers" }), "newco");
      const found = await expectRowsFor(api, { ...defaults, search: "newco" });
      expect(found.items.map((c) => c.name)).toEqual([NEW_CUSTOMER.name]);

      // The new company is offered in the company filter.
      await user.click(screen.getByRole("button", { name: /^Filters/ }));
      const panel = within(screen.getByRole("dialog", { name: "Filters" }));
      const group = await panel.findByRole("group", { name: "Companies" });
      await user.click(within(group).getByRole("checkbox", { name: NEW_CUSTOMER.company }));
      await user.click(panel.getByRole("button", { name: "Apply filters" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(getMockSearch()).toBe("q=newco&company=NewCo+Ventures");

      // Delete it: the filtered list becomes empty and can be cleared.
      const created = (await api.allCustomers()).find((c) => c.email === NEW_CUSTOMER.email);
      await chooseRowAction(created as Customer, "Delete");
      await user.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete customer" }),
      );
      expect(await screen.findByText("No customers found")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Clear all filters" }));
      const clearButtons = screen.getAllByRole("button", { name: "Clear search" });
      await user.click(clearButtons[clearButtons.length - 1]);
      await expectRowsFor(api, defaults);

      const header = screen.getByRole("columnheader", { name: "Name" });
      await user.click(within(header).getByRole("button"));
      await expectRowsFor(api, { ...defaults, sortBy: "name", sortOrder: "asc" });
      await user.click(screen.getByRole("button", { name: "Next page" }));
      await expectRowsFor(api, { ...defaults, sortBy: "name", sortOrder: "asc", page: 2 });
    });
  });
});
