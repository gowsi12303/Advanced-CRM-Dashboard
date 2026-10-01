import { createElement } from "react";
import type { DndContextProps } from "@dnd-kit/core";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { installMockApi } from "@/test/mock-api";
import { getMockSearch, setMockSearch } from "@/test/navigation-mock";

import { columnDropId, toBoardParams, toColumns } from "../../lib/pipeline";
import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  EMPTY_CUSTOMER_FILTERS,
  type Customer,
  type CustomerFilters,
  type CustomerStatus,
} from "../../types";
import { renderPipelineView, type MockApi } from "../test-utils";

vi.mock("next/navigation", () => import("@/test/navigation-mock"));

// jsdom has no layout, so real pointer or keyboard drags can't be simulated:
// every element measures 0x0 and collision detection has nothing to work with.
// Instead the real DndContext is wrapped to expose the handlers the board gave
// it, and tests fire the same events dnd-kit would. Everything from those
// handlers onwards (ordering, the optimistic cache update, the API call and
// rollback) is the real code. Real drags are covered by the browser checks.
const dnd = vi.hoisted(() => ({ props: null as DndContextProps | null }));
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: (props: DndContextProps) => {
      dnd.props = props;
      return createElement(actual.DndContext, props);
    },
  };
});

const isMove = (method: string, path: string) =>
  method === "POST" && path.endsWith("/move");

/**
 * Simulates picking a card up, passing over each target, and dropping on the
 * last. Once a card has entered another column its placeholder sits under the
 * pointer, so a realistic cross-column drag ends over the card itself.
 */
function drag(cardId: string, ...overIds: (string | null)[]) {
  const event = (overId: string | null | undefined) =>
    ({ active: { id: cardId }, over: overId ? { id: overId } : null }) as never;
  act(() => dnd.props?.onDragStart?.(event(undefined)));
  for (const overId of overIds) act(() => dnd.props?.onDragOver?.(event(overId)));
  act(() => dnd.props?.onDragEnd?.(event(overIds.at(-1))));
}

function column(status: CustomerStatus) {
  return screen.getByRole("region", {
    name: new RegExp(`^${CUSTOMER_STATUS_LABELS[status]}, `),
  });
}

function cardIds(status: CustomerStatus) {
  return [...column(status).querySelectorAll("li[data-customer-id]")].map((card) =>
    card.getAttribute("data-customer-id"),
  );
}

function boardColumns() {
  return Object.fromEntries(CUSTOMER_STATUSES.map((status) => [status, cardIds(status)]));
}

describe("PipelineView", () => {
  let api: MockApi;
  let user: UserEvent;

  beforeEach(() => {
    toast.dismiss();
    dnd.props = null;
    setMockSearch("");
    api = installMockApi();
    user = userEvent.setup();
  });

  /** What the store says the board should look like for a search and filters. */
  async function storeColumns(search = "", filters: Partial<CustomerFilters> = {}) {
    const result = await api.expected(
      toBoardParams(search, { ...EMPTY_CUSTOMER_FILTERS, ...filters }),
    );
    return { customers: result.items, columns: toColumns(result.items) };
  }

  /** Waits until the rendered board equals the store. */
  async function expectBoardMatchesStore(search = "", filters: Partial<CustomerFilters> = {}) {
    // The store is re-read on every attempt: a write may still be in flight.
    let expected = await storeColumns(search, filters);
    await waitFor(async () => {
      expected = await storeColumns(search, filters);
      expect(boardColumns()).toEqual(expected.columns);
    });
    return expected;
  }

  async function renderLoaded(search = "", filters: Partial<CustomerFilters> = {}) {
    renderPipelineView();
    await screen.findByRole("group", { name: "Pipeline board" });
    return expectBoardMatchesStore(search, filters);
  }

  const byId = (customers: Customer[], id: string) =>
    customers.find((customer) => customer.id === id) as Customer;
  /** A customer in `ids` whose name appears only once on the board. */
  const uniquelyNamed = (customers: Customer[], ids: string[]) =>
    byId(
      customers,
      ids.find(
        (id) =>
          customers.filter((c) => c.name === byId(customers, id).name).length === 1,
      ) as string,
    );

  describe("rendering", () => {
    it("shows a column per status with its customers and count", async () => {
      const { customers, columns } = await renderLoaded();

      expect(
        [...document.querySelectorAll("section[data-status]")].map((region) =>
          region.getAttribute("data-status"),
        ),
      ).toEqual([
        "lead",
        "prospect",
        "active",
        "inactive",
        "churned",
      ]);
      expect(customers).toHaveLength(150);

      for (const status of CUSTOMER_STATUSES) {
        const region = within(column(status));
        const count = columns[status].length;
        expect(count).toBeGreaterThan(0);
        expect(region.getByRole("heading", { name: CUSTOMER_STATUS_LABELS[status] })).toBeVisible();
        expect(column(status)).toHaveAccessibleName(
          `${CUSTOMER_STATUS_LABELS[status]}, ${count} customers`,
        );
        expect(region.getByText(String(count), { selector: "[data-slot=badge]" })).toBeVisible();
        // Every card is in the column of its own status, in rank order.
        expect(cardIds(status)).toEqual(columns[status]);
        expect(columns[status].every((id) => byId(customers, id).status === status)).toBe(true);
      }
      expect(screen.getByText("customers")).toHaveTextContent("150 customers");
      // One request loads the whole board.
      expect(api.listRequests).toHaveLength(1);
      expect(api.listRequests[0].get("sortBy")).toBe("pipelineRank");
      expect(api.listRequests[0].get("pageSize")).toBe("500");
    });

    it("shows useful details on each card", async () => {
      const { customers, columns } = await renderLoaded();
      const customer = byId(customers, columns.active[0]);
      const card = within(
        column("active").querySelector(`[data-customer-id="${customer.id}"]`) as HTMLElement,
      );

      expect(card.getByRole("button", { name: customer.name })).toBeVisible();
      expect(card.getByText(`${customer.jobTitle} · ${customer.company}`)).toBeVisible();
      expect(card.getByText(customer.email)).toBeVisible();
      expect(card.getByText("Active")).toBeVisible();
      expect(card.getByText(/^Contacted |^Never contacted$/)).toBeVisible();
    });

    it("shows a loading skeleton first", async () => {
      api.pause();
      renderPipelineView();

      expect(screen.getByLabelText("Loading pipeline")).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Pipeline board" })).toBeNull();

      api.resume();
      await expectBoardMatchesStore();
      expect(screen.queryByLabelText("Loading pipeline")).toBeNull();
    });

    it("shows an empty state when nothing matches, and can clear the search", async () => {
      setMockSearch("q=zzzz-no-match");
      renderPipelineView();

      expect(await screen.findByText("No customers found")).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Pipeline board" })).toBeNull();

      const clearButtons = await screen.findAllByRole("button", { name: "Clear search" });
      await user.click(clearButtons[clearButtons.length - 1]);
      await screen.findByRole("group", { name: "Pipeline board" });
      await expectBoardMatchesStore();
    });

    it("shows an error state and recovers on Retry", async () => {
      api.setFailing(true);
      renderPipelineView();

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Couldn't load the pipeline");
      expect(alert).toHaveTextContent("Database unavailable");

      api.setFailing(false);
      await user.click(within(alert).getByRole("button", { name: "Retry" }));
      await screen.findByRole("group", { name: "Pipeline board" });
      await expectBoardMatchesStore();
    });
  });

  describe("dragging between columns", () => {
    it("moves the card at once, calls the move API, and keeps it there on success", async () => {
      const { columns } = await renderLoaded();
      const card = columns.lead[0];
      const target = columns.prospect[2];

      api.pause(isMove);
      drag(card, target, card);

      // Optimistic: the board has changed before the API has answered.
      expect(cardIds("lead")).toEqual(columns.lead.slice(1));
      expect(cardIds("prospect")).toEqual([
        ...columns.prospect.slice(0, 2),
        card,
        ...columns.prospect.slice(2),
      ]);
      expect(column("lead")).toHaveAccessibleName(`Lead, ${columns.lead.length - 1} customers`);
      expect(column("prospect")).toHaveAccessibleName(
        `Prospect, ${columns.prospect.length + 1} customers`,
      );
      // The card takes on its new status as soon as the cache update lands.
      await waitFor(() =>
        expect(
          within(
            column("prospect").querySelector(`[data-customer-id="${card}"]`) as HTMLElement,
          ).getByText("Prospect"),
        ).toBeVisible(),
      );
      expect(await screen.findByLabelText("Saving")).toBeInTheDocument();
      expect((await api.repository.get(card)).status).toBe("lead");

      await waitFor(() => expect(api.mutations).toHaveLength(1));
      expect(api.mutations[0]).toEqual({
        method: "POST",
        path: `/api/customers/${card}/move`,
        body: { status: "prospect", beforeId: target },
      });

      api.resume();
      await waitFor(async () => expect((await api.repository.get(card)).status).toBe("prospect"));
      const after = await expectBoardMatchesStore();
      expect(after.columns.prospect.indexOf(card)).toBe(2);
      await waitFor(() => expect(screen.queryByLabelText("Saving")).toBeNull());
      expect(api.mutations).toHaveLength(1);
    });

    it("drops at the end of a column when released over the column itself", async () => {
      const { columns } = await renderLoaded();
      const card = columns.active[3];

      drag(card, columnDropId("churned"));

      expect(cardIds("churned")).toEqual([...columns.churned, card]);
      await waitFor(() => expect(api.mutations).toHaveLength(1));
      expect(api.mutations[0].body).toEqual({ status: "churned", beforeId: null });
      const after = await expectBoardMatchesStore();
      expect(after.columns.churned.at(-1)).toBe(card);
    });

    it("can pass over several columns before dropping", async () => {
      const { columns } = await renderLoaded();
      const card = columns.lead[1];

      drag(card, columns.prospect[0], columns.active[0], columns.inactive[1], card);

      expect(cardIds("inactive")[1]).toBe(card);
      expect(cardIds("prospect")).toEqual(columns.prospect);
      expect(cardIds("active")).toEqual(columns.active);
      await waitFor(() => expect(api.mutations).toHaveLength(1));
      expect(api.mutations[0].body).toEqual({
        status: "inactive",
        beforeId: columns.inactive[1],
      });
      await expectBoardMatchesStore();
    });

    it("drops into an empty column", async () => {
      // With this filter only leads are on the board; the other columns are empty.
      setMockSearch("status=lead");
      const { columns } = await renderLoaded("", { status: ["lead"] });
      expect(cardIds("active")).toEqual([]);
      expect(within(column("active")).getByText("No customers")).toBeVisible();
      const card = columns.lead[0];

      api.pause(isMove);
      drag(card, columnDropId("active"));
      expect(cardIds("active")).toEqual([card]);
      await waitFor(() => expect(api.mutations).toHaveLength(1));
      expect(api.mutations[0].body).toEqual({ status: "active", beforeId: null });

      api.resume();
      await waitFor(async () => expect((await api.repository.get(card)).status).toBe("active"));
      // It no longer matches the "lead" filter, so the refreshed board drops it.
      await expectBoardMatchesStore("", { status: ["lead"] });
      expect(cardIds("active")).toEqual([]);
    });
  });

  describe("reordering within a column", () => {
    it("moves a card down and persists the position", async () => {
      const { columns } = await renderLoaded();
      const [first, second, third, fourth] = columns.lead;

      api.pause(isMove);
      drag(first, third);
      expect(cardIds("lead").slice(0, 4)).toEqual([second, third, first, fourth]);

      await waitFor(() => expect(api.mutations).toHaveLength(1));
      expect(api.mutations[0]).toEqual({
        method: "POST",
        path: `/api/customers/${first}/move`,
        body: { status: "lead", beforeId: fourth },
      });

      api.resume();
      const after = await expectBoardMatchesStore();
      expect(after.columns.lead.slice(0, 4)).toEqual([second, third, first, fourth]);
      expect(column("lead")).toHaveAccessibleName(`Lead, ${columns.lead.length} customers`);
    });

    it("moves a card up and persists the position", async () => {
      const { columns } = await renderLoaded();
      const [first, second, third, fourth] = columns.active;

      drag(fourth, second);

      expect(cardIds("active").slice(0, 4)).toEqual([first, fourth, second, third]);
      await waitFor(() => expect(api.mutations).toHaveLength(1));
      expect(api.mutations[0].body).toEqual({ status: "active", beforeId: second });
      const after = await expectBoardMatchesStore();
      expect(after.columns.active.slice(0, 4)).toEqual([first, fourth, second, third]);
    });

    it("moves a card to the bottom of its column", async () => {
      const { columns } = await renderLoaded();
      const card = columns.churned[0];

      drag(card, columns.churned.at(-1) as string);

      expect(cardIds("churned")).toEqual([...columns.churned.slice(1), card]);
      await waitFor(() => expect(api.mutations).toHaveLength(1));
      expect(api.mutations[0].body).toEqual({ status: "churned", beforeId: null });
      await expectBoardMatchesStore();
    });

    it("applies several quick moves in order", async () => {
      const { columns } = await renderLoaded();
      const [a, b, c] = columns.lead;

      api.pause(isMove);
      drag(a, c);
      drag(b, columnDropId("prospect"));
      expect(cardIds("lead").slice(0, 2)).toEqual([c, a]);
      expect(cardIds("prospect").at(-1)).toBe(b);
      await waitFor(() => expect(api.mutations).toHaveLength(2));

      api.resume();
      const after = await expectBoardMatchesStore();
      expect(after.columns.lead.slice(0, 2)).toEqual([c, a]);
      expect(after.columns.prospect.at(-1)).toBe(b);
    });
  });

  describe("drops that change nothing", () => {
    it.each([
      ["outside every column", (): (string | null)[] => [null]],
      ["back on its own position", (ids: string[]) => [ids[0]]],
      ["over a neighbour and back", (ids: string[]) => [ids[2], ids[0]]],
    ])("sends nothing when dropped %s", async (_label, targets) => {
      const { columns } = await renderLoaded();
      const before = boardColumns();

      drag(columns.lead[0], ...targets(columns.lead));

      expect(boardColumns()).toEqual(before);
      expect(api.mutations).toHaveLength(0);
      expect(screen.queryByLabelText("Saving")).toBeNull();
    });

    it("restores the board when a drag is cancelled", async () => {
      const { columns } = await renderLoaded();
      const before = boardColumns();
      const event = (overId?: string) =>
        ({ active: { id: columns.lead[0] }, over: overId ? { id: overId } : null }) as never;

      act(() => dnd.props?.onDragStart?.(event()));
      act(() => dnd.props?.onDragOver?.(event(columns.active[0])));
      // Mid-drag the card previews in the other column, marked as the drop target.
      expect(cardIds("active")[0]).toBe(columns.lead[0]);
      expect(column("active").className).toContain("border-primary/50");
      expect(column("lead").className).not.toContain("border-primary/50");

      act(() => dnd.props?.onDragCancel?.(event()));
      expect(boardColumns()).toEqual(before);
      expect(column("active").className).not.toContain("border-primary/50");
      expect(api.mutations).toHaveLength(0);
    });
  });

  describe("when the move fails", () => {
    it("rolls the card back, shows an error toast and stays consistent with the server", async () => {
      const { customers, columns } = await renderLoaded();
      const card = columns.lead[0];
      const name = byId(customers, card).name;
      const before = boardColumns();

      api.pause(isMove);
      api.failWhen(isMove);
      drag(card, columns.active[1], card);
      // The optimistic move is visible while the request is in flight…
      expect(cardIds("active")[1]).toBe(card);
      expect(cardIds("lead")).not.toContain(card);

      api.resume();
      // …and is undone when it fails.
      await waitFor(() => expect(boardColumns()).toEqual(before));
      expect(await screen.findByText(`Couldn't move ${name}`)).toBeInTheDocument();
      expect(screen.getByText(/Database unavailable.*returned to Lead/)).toBeInTheDocument();

      expect((await api.repository.get(card)).status).toBe("lead");
      await expectBoardMatchesStore();
      expect(column("lead")).toHaveAccessibleName(`Lead, ${columns.lead.length} customers`);
      await waitFor(() => expect(screen.queryByLabelText("Saving")).toBeNull());
    });

    it("rolls back a failed reorder", async () => {
      const { columns } = await renderLoaded();
      const before = boardColumns();
      api.failWhen(isMove);

      drag(columns.prospect[0], columns.prospect[3]);

      expect(await screen.findByText(/^Couldn't move /)).toBeInTheDocument();
      await waitFor(() => expect(boardColumns()).toEqual(before));
      await expectBoardMatchesStore();
    });

    it("lets the user retry the same move afterwards", async () => {
      const { columns } = await renderLoaded();
      const card = columns.lead[0];
      const restore = api.failWhen(isMove);

      drag(card, columnDropId("prospect"));
      await screen.findByText(/^Couldn't move /);
      await waitFor(() => expect(cardIds("lead")[0]).toBe(card));

      restore();
      drag(card, columnDropId("prospect"));
      await waitFor(async () => expect((await api.repository.get(card)).status).toBe("prospect"));
      await expectBoardMatchesStore();
    });
  });

  describe("search and filters", () => {
    it("restores filters from the URL and explains that the board is narrowed", async () => {
      setMockSearch("company=Vela+Software&company=Quartz+Financial");
      const filters = { companies: ["Quartz Financial", "Vela Software"] };
      const { customers } = await renderLoaded("", filters);

      expect(customers.length).toBeGreaterThan(0);
      expect(customers.length).toBeLessThan(150);
      expect(customers.every((c) => filters.companies.includes(c.company))).toBe(true);
      expect(screen.getByRole("note")).toHaveTextContent(
        "Only customers matching the current search and filters are shown.",
      );
      expect(screen.getByRole("button", { name: "Filters, 1 active" })).toBeVisible();
      expect(screen.getByText("customers")).toHaveTextContent(`${customers.length} customers`);
    });

    it("has no note when nothing narrows the board", async () => {
      await renderLoaded();
      expect(screen.queryByRole("note")).toBeNull();
    });

    it("narrows the board from the search box and keeps the URL in sync", async () => {
      await renderLoaded();

      await user.type(screen.getByRole("searchbox", { name: "Search customers" }), "quartz");
      const { customers } = await expectBoardMatchesStore("quartz");
      expect(customers.length).toBeGreaterThan(0);
      expect(customers.every((c) => c.company === "Quartz Financial")).toBe(true);
      expect(getMockSearch()).toBe("q=quartz");
      // Board requests never carry table paging or sorting from the URL.
      expect(api.listRequests.at(-1)?.get("sortBy")).toBe("pipelineRank");
    });

    it("applies filters from the filter panel and clears them", async () => {
      await renderLoaded();

      await user.click(screen.getByRole("button", { name: /^Filters/ }));
      const panel = within(screen.getByRole("dialog", { name: "Filters" }));
      await user.click(panel.getByRole("checkbox", { name: "Lead" }));
      await user.click(panel.getByRole("checkbox", { name: "Churned" }));
      await user.click(panel.getByRole("button", { name: "Apply filters" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      await expectBoardMatchesStore("", { status: ["lead", "churned"] });
      expect(cardIds("active")).toEqual([]);
      expect(cardIds("lead").length).toBeGreaterThan(0);
      expect(getMockSearch()).toBe("status=lead&status=churned");

      await user.click(screen.getByRole("button", { name: "Clear filters" }));
      await expectBoardMatchesStore();
      expect(getMockSearch()).toBe("");
    });

    it("positions a card relative to the visible cards when filtered", async () => {
      setMockSearch("company=Quartz+Financial");
      const filters = { companies: ["Quartz Financial"] };
      const { columns } = await renderLoaded("", filters);
      const status = CUSTOMER_STATUSES.find((s) => columns[s].length >= 3) as CustomerStatus;
      const [first, second, third] = columns[status];

      drag(third, first);

      expect(cardIds(status).slice(0, 3)).toEqual([third, first, second]);
      await waitFor(() => expect(api.mutations).toHaveLength(1));
      expect(api.mutations[0].body).toEqual({ status, beforeId: first });

      // In the full, unfiltered column it sits directly before that card.
      await expectBoardMatchesStore("", filters);
      const everyone = (await storeColumns()).columns[status];
      expect(everyone.indexOf(third)).toBe(everyone.indexOf(first) - 1);
    });

    it("moves a card between columns while a search is active", async () => {
      setMockSearch("q=quartz");
      const { columns } = await renderLoaded("quartz");
      const from = CUSTOMER_STATUSES.find((s) => columns[s].length > 0) as CustomerStatus;
      const to = CUSTOMER_STATUSES.find((s) => s !== from) as CustomerStatus;
      const card = columns[from][0];

      drag(card, columnDropId(to));

      await waitFor(async () => expect((await api.repository.get(card)).status).toBe(to));
      const after = await expectBoardMatchesStore("quartz");
      expect(after.columns[to]).toContain(card);
      expect(getMockSearch()).toBe("q=quartz");
    });
  });

  describe("cards", () => {
    it("opens the shared customer details drawer from a card", async () => {
      const { customers, columns } = await renderLoaded();
      const customer = uniquelyNamed(customers, columns.prospect);

      await user.click(
        within(column("prospect")).getByRole("button", { name: customer.name }),
      );
      const drawer = within(await screen.findByRole("dialog", { name: customer.name }));
      expect(await drawer.findByRole("link", { name: customer.email })).toBeInTheDocument();
      expect(drawer.getByRole("heading", { name: /^Notes/ })).toBeInTheDocument();
      expect(drawer.getByRole("button", { name: "Log contact" })).toBeInTheDocument();
      // Opening details is not a move.
      expect(api.mutations).toHaveLength(0);
    });

    it("moves the card when its status is edited from the drawer", async () => {
      const { customers, columns } = await renderLoaded();
      const customer = uniquelyNamed(customers, columns.lead);

      await user.click(within(column("lead")).getByRole("button", { name: customer.name }));
      const drawer = within(await screen.findByRole("dialog", { name: customer.name }));
      await user.click(await drawer.findByRole("button", { name: "Edit" }));
      const dialog = within(screen.getByRole("dialog", { name: "Edit customer" }));
      await user.click(await dialog.findByRole("combobox", { name: /Status/ }));
      await user.click(await screen.findByRole("option", { name: "Inactive" }));
      await user.click(dialog.getByRole("button", { name: "Save changes" }));

      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit customer" })).toBeNull());
      await user.click(screen.getByRole("button", { name: "Close" }));
      const after = await expectBoardMatchesStore();
      expect(after.columns.inactive.at(-1)).toBe(customer.id);
      expect(after.columns.lead).not.toContain(customer.id);
    });

    it("offers a menu to move a card without dragging", async () => {
      const { customers, columns } = await renderLoaded();
      const customer = uniquelyNamed(customers, columns.lead);

      await user.click(
        within(column("lead")).getByRole("button", { name: `Actions for ${customer.name}` }),
      );
      const items = (await screen.findAllByRole("menuitem")).map((item) => item.textContent);
      expect(items).toEqual(["View details", "Prospect", "Active", "Inactive", "Churned"]);

      api.pause(isMove);
      await user.click(screen.getByRole("menuitem", { name: "Active" }));
      await waitFor(() => expect(cardIds("active").at(-1)).toBe(customer.id));
      expect(api.mutations[0]).toEqual({
        method: "POST",
        path: `/api/customers/${customer.id}/move`,
        body: { status: "active", beforeId: null },
      });

      api.resume();
      const after = await expectBoardMatchesStore();
      expect(after.columns.active.at(-1)).toBe(customer.id);
    });

    it("adds a new customer to the end of its column", async () => {
      const { columns } = await renderLoaded();

      await user.keyboard("n");
      const dialog = within(await screen.findByRole("dialog", { name: "Add customer" }));
      await user.type(dialog.getByLabelText(/Full name/), "Board Newcomer");
      await user.type(dialog.getByLabelText(/Email/), "board.newcomer@example.com");
      await user.type(dialog.getByLabelText(/Phone/), "+1 415 555 0199");
      await user.type(dialog.getByLabelText(/Company/), "Newcomer Co");
      await user.click(dialog.getByRole("button", { name: "Add customer" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      const after = await expectBoardMatchesStore();
      expect(after.columns.lead).toHaveLength(columns.lead.length + 1);
      expect(byId(after.customers, after.columns.lead.at(-1) as string).name).toBe("Board Newcomer");
    });
  });

  describe("accessibility", () => {
    it("gives every card a labelled, keyboard-focusable move handle with instructions", async () => {
      const { customers, columns } = await renderLoaded();
      const customer = uniquelyNamed(customers, columns.lead);

      const handle = screen.getByRole("button", { name: `Move ${customer.name}` });
      expect(handle).toHaveAttribute("tabindex", "0");
      expect(handle).toHaveAttribute("aria-roledescription", "sortable");
      expect(handle).toHaveAccessibleDescription(
        /press Space or Enter on its move handle.*arrow keys.*Escape to cancel/,
      );
      expect(screen.getAllByRole("button", { name: /^Move / })).toHaveLength(150);
    });

    it("announces drags in terms of customer names, columns and positions", async () => {
      const { customers, columns } = await renderLoaded();
      const card = columns.lead[0];
      const name = byId(customers, card).name;
      const announce = dnd.props?.accessibility?.announcements;
      const event = (overId?: string) =>
        ({ active: { id: card }, over: overId ? { id: overId } : null }) as never;

      expect(announce?.onDragStart?.(event())).toBe(`Picked up ${name}.`);
      expect(announce?.onDragOver?.(event(columns.prospect[1]))).toBe(
        `${name} is over the Prospect column, position 2 of ${columns.prospect.length + 1}.`,
      );
      expect(announce?.onDragOver?.(event(columnDropId("churned")))).toBe(
        `${name} is over the Churned column, position ${columns.churned.length + 1} of ${columns.churned.length + 1}.`,
      );
      expect(announce?.onDragOver?.(event())).toBe(`${name} is not over a column.`);
      expect(announce?.onDragEnd?.(event(columns.lead[2]))).toBe(
        `${name} was dropped in the Lead column, position 3 of ${columns.lead.length}.`,
      );
      expect(announce?.onDragCancel?.(event())).toBe(
        `Moving ${name} was cancelled. It was returned to its place.`,
      );
    });
  });
});
