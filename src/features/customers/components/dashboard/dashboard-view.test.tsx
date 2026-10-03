import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatDate, toLocalDateOnly } from "@/lib/format";
import { installMockApi } from "@/test/mock-api";
import { setMockSearch } from "@/test/navigation-mock";

import { FILTER_TEMPLATES } from "../../lib/filter-templates";
import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  DEFAULT_CUSTOMER_LIST_PARAMS,
  EMPTY_CUSTOMER_FILTERS,
  type CustomerFilters,
} from "../../types";
import type { MockApi } from "../test-utils";
import { DashboardView } from "./dashboard-view";

vi.mock("next/navigation", () => import("@/test/navigation-mock"));

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardView />
    </QueryClientProvider>,
  );
}

describe("DashboardView", () => {
  let api: MockApi;

  beforeEach(() => {
    setMockSearch("", "/dashboard");
    api = installMockApi();
  });

  /** The store's own answer for how many customers match a filter set. */
  const countOf = async (filters: Partial<CustomerFilters>) =>
    (
      await api.expected({
        ...DEFAULT_CUSTOMER_LIST_PARAMS,
        filters: { ...EMPTY_CUSTOMER_FILTERS, ...filters },
      })
    ).total;

  const card = (label: string) =>
    within(screen.getByRole("region", { name: "Key figures" })).getByRole("link", {
      name: new RegExp(`^${label}`),
    });

  const weekStart = () => {
    const now = new Date();
    return toLocalDateOnly(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  };

  it("shows key figures calculated from the customer data", async () => {
    const followUp = FILTER_TEMPLATES.find((t) => t.id === "no-contact-30-days")?.build(new Date());
    const expected = {
      total: await countOf({}),
      leads: await countOf({ status: ["lead"] }),
      week: await countOf({ dateField: "lastContactedAt", dateFrom: weekStart() }),
      followUp: await countOf(followUp ?? {}),
    };
    expect(expected.total).toBe(150);
    expect(expected.leads).toBeGreaterThan(0);

    renderDashboard();
    // Numbers are placeholders until the data arrives.
    expect(screen.getByLabelText("Loading total customers")).toBeInTheDocument();

    await waitFor(() => {
      expect(card("Total customers")).toHaveTextContent(String(expected.total));
      expect(card("Active leads")).toHaveTextContent(String(expected.leads));
      expect(card("Contacted this week")).toHaveTextContent(String(expected.week));
      expect(card("Need follow-up")).toHaveTextContent(String(expected.followUp));
    });
    expect(screen.queryByLabelText("Loading total customers")).toBeNull();
  });

  it("links each figure to the matching customers", async () => {
    renderDashboard();
    await waitFor(() => expect(card("Total customers")).toHaveTextContent("150"));

    expect(card("Total customers")).toHaveAttribute("href", "/customers");
    expect(card("Active leads")).toHaveAttribute("href", "/customers?status=lead");
    expect(card("Contacted this week")).toHaveAttribute(
      "href",
      `/customers?dateField=lastContactedAt&from=${weekStart()}`,
    );
    expect(card("Need follow-up").getAttribute("href")).toMatch(
      /^\/customers\?status=lead&status=prospect&status=active&dateField=lastContactedAt&to=\d{4}-\d{2}-\d{2}&never=1$/,
    );
  });

  it("breaks customers down by status, linking each to its filter", async () => {
    renderDashboard();
    const section = within(screen.getByRole("region", { name: "Customers by status" }));

    let sum = 0;
    for (const status of CUSTOMER_STATUSES) {
      const count = await countOf({ status: [status] });
      sum += count;
      const link = section.getByRole("link", { name: new RegExp(`^${CUSTOMER_STATUS_LABELS[status]}`) });
      await waitFor(() => expect(link).toHaveTextContent(String(count)));
      expect(link).toHaveAttribute("href", `/customers?status=${status}`);
    }
    expect(sum).toBe(150);
    expect(section.getByRole("link", { name: "Open pipeline" })).toHaveAttribute("href", "/pipeline");
  });

  it("lists the most recently added customers, linking to their details", async () => {
    const newest = (await api.expected(DEFAULT_CUSTOMER_LIST_PARAMS)).items.slice(0, 5);
    renderDashboard();
    const section = within(screen.getByRole("region", { name: "Recently added" }));

    const items = await section.findAllByRole("listitem");
    expect(items).toHaveLength(5);
    newest.forEach((customer, index) => {
      const item = within(items[index]);
      expect(item.getByRole("link", { name: customer.name })).toHaveAttribute(
        "href",
        `/customers?customer=${customer.id}`,
      );
      expect(item.getByText(customer.company)).toBeInTheDocument();
      expect(item.getByText(CUSTOMER_STATUS_LABELS[customer.status])).toBeInTheDocument();
      expect(item.getByText(formatDate(customer.createdAt))).toBeInTheDocument();
    });
  });

  it("reflects changes to the data", async () => {
    await api.repository.create({
      name: "Newest Person",
      email: "newest.person@example.com",
      phone: "+1 415 555 0100",
      company: "Fresh Co",
      status: "lead",
    });
    const leads = await countOf({ status: ["lead"] });

    renderDashboard();
    await waitFor(() => {
      expect(card("Total customers")).toHaveTextContent("151");
      expect(card("Active leads")).toHaveTextContent(String(leads));
    });
    const recent = within(screen.getByRole("region", { name: "Recently added" }));
    expect((await recent.findAllByRole("listitem"))[0]).toHaveTextContent("Newest Person");
  });

  it("shows an error with Retry, and recovers", async () => {
    const user = userEvent.setup();
    api.setFailing(true);
    renderDashboard();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load the dashboard");
    expect(alert).toHaveTextContent("Database unavailable");
    // No number is invented while the data is unavailable.
    expect(card("Total customers")).toHaveTextContent("—");

    api.setFailing(false);
    await user.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(card("Total customers")).toHaveTextContent("150"));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    const recent = within(screen.getByRole("region", { name: "Recently added" }));
    expect(await recent.findAllByRole("listitem")).toHaveLength(5);
  });
});
