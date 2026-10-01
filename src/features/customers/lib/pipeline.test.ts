import { describe, expect, it } from "vitest";

import { EMPTY_CUSTOMER_FILTERS, MAX_PAGE_SIZE, type Customer } from "../types";
import {
  applyMove,
  columnDropId,
  findColumn,
  placeCard,
  toBoardParams,
  toColumns,
  toMoveInput,
  type BoardColumns,
} from "./pipeline";

function customer(id: string, status: Customer["status"]): Customer {
  return {
    id,
    name: id.toUpperCase(),
    email: `${id}@example.com`,
    phone: "+1 415 555 0100",
    company: "Acme",
    jobTitle: "",
    status,
    pipelineRank: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastContactedAt: null,
    lastContactMethod: null,
  };
}

// Board order: leads a, b, c, d; prospects p, q; no one else.
const CUSTOMERS = [
  customer("a", "lead"),
  customer("p", "prospect"),
  customer("b", "lead"),
  customer("c", "lead"),
  customer("q", "prospect"),
  customer("d", "lead"),
];
const COLUMNS: BoardColumns = {
  lead: ["a", "b", "c", "d"],
  prospect: ["p", "q"],
  active: [],
  inactive: [],
  churned: [],
};

describe("toBoardParams", () => {
  it("asks for every matching customer in board order", () => {
    const filters = { ...EMPTY_CUSTOMER_FILTERS, status: ["lead" as const] };
    expect(toBoardParams("ann", filters)).toEqual({
      search: "ann",
      filters,
      sortBy: "pipelineRank",
      sortOrder: "asc",
      page: 1,
      pageSize: MAX_PAGE_SIZE,
    });
  });
});

describe("toColumns and findColumn", () => {
  it("groups customers by status, keeping list order", () => {
    expect(toColumns(CUSTOMERS)).toEqual(COLUMNS);
  });

  it("finds the column of a card or of a column drop id", () => {
    expect(findColumn(COLUMNS, "c")).toBe("lead");
    expect(findColumn(COLUMNS, "q")).toBe("prospect");
    expect(findColumn(COLUMNS, columnDropId("churned"))).toBe("churned");
    expect(findColumn(COLUMNS, "missing")).toBeUndefined();
    expect(findColumn(COLUMNS, "column:bogus")).toBeUndefined();
  });
});

describe("placeCard", () => {
  it("moves a card down within its column, landing after the hovered card", () => {
    expect(placeCard(COLUMNS, "a", "c").lead).toEqual(["b", "c", "a", "d"]);
    expect(placeCard(COLUMNS, "a", "d").lead).toEqual(["b", "c", "d", "a"]);
  });

  it("moves a card up within its column, landing before the hovered card", () => {
    expect(placeCard(COLUMNS, "d", "b").lead).toEqual(["a", "d", "b", "c"]);
    expect(placeCard(COLUMNS, "c", "a").lead).toEqual(["c", "a", "b", "d"]);
  });

  it("moves a card into another column before the hovered card", () => {
    const next = placeCard(COLUMNS, "b", "q");
    expect(next.lead).toEqual(["a", "c", "d"]);
    expect(next.prospect).toEqual(["p", "b", "q"]);
  });

  it("moves a card to the end of a column when dropped on the column itself", () => {
    expect(placeCard(COLUMNS, "a", columnDropId("prospect")).prospect).toEqual(["p", "q", "a"]);
    expect(placeCard(COLUMNS, "a", columnDropId("active")).active).toEqual(["a"]);
    expect(placeCard(COLUMNS, "a", columnDropId("lead")).lead).toEqual(["b", "c", "d", "a"]);
  });

  it("leaves the board alone for a card over itself or an unknown target", () => {
    expect(placeCard(COLUMNS, "a", "a")).toBe(COLUMNS);
    expect(placeCard(COLUMNS, "a", "missing")).toBe(COLUMNS);
    expect(placeCard(COLUMNS, "missing", "a")).toBe(COLUMNS);
  });

  it("does not mutate its input", () => {
    const snapshot = structuredClone(COLUMNS);
    placeCard(COLUMNS, "b", "q");
    expect(COLUMNS).toEqual(snapshot);
  });
});

describe("toMoveInput", () => {
  it("describes a card's place as its status and the card after it", () => {
    expect(toMoveInput(COLUMNS, "a")).toEqual({ status: "lead", beforeId: "b" });
    expect(toMoveInput(COLUMNS, "d")).toEqual({ status: "lead", beforeId: null });
    expect(toMoveInput(COLUMNS, "p")).toEqual({ status: "prospect", beforeId: "q" });
    expect(toMoveInput(COLUMNS, "missing")).toBeUndefined();
  });
});

describe("applyMove", () => {
  const order = (customers: Customer[]) => toColumns(customers);

  it("changes status and position together", () => {
    const next = applyMove(CUSTOMERS, "b", { status: "prospect", beforeId: "q" });
    expect(order(next)).toEqual({ ...COLUMNS, lead: ["a", "c", "d"], prospect: ["p", "b", "q"] });
    expect(next.find((c) => c.id === "b")?.status).toBe("prospect");
  });

  it("reorders within a column", () => {
    expect(order(applyMove(CUSTOMERS, "a", { status: "lead", beforeId: "d" })).lead).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
  });

  it("puts the card last in the column when there is no card after it", () => {
    expect(order(applyMove(CUSTOMERS, "a", { status: "lead", beforeId: null })).lead).toEqual([
      "b",
      "c",
      "d",
      "a",
    ]);
    expect(order(applyMove(CUSTOMERS, "a", { status: "churned", beforeId: null })).churned).toEqual(["a"]);
  });

  it("matches the arrangement a drag preview produced", () => {
    for (const [card, over] of [
      ["a", "c"],
      ["d", "b"],
      ["b", "q"],
      ["a", columnDropId("active")],
      ["q", "a"],
    ]) {
      const preview = placeCard(COLUMNS, card, over);
      const input = toMoveInput(preview, card);
      expect(input).toBeDefined();
      if (input) expect(order(applyMove(CUSTOMERS, card, input))).toEqual(preview);
    }
  });

  it("returns an equal list for an unknown customer and never mutates", () => {
    const snapshot = structuredClone(CUSTOMERS);
    expect(applyMove(CUSTOMERS, "missing", { status: "lead", beforeId: null })).toEqual(CUSTOMERS);
    applyMove(CUSTOMERS, "a", { status: "active", beforeId: null });
    expect(CUSTOMERS).toEqual(snapshot);
  });
});
