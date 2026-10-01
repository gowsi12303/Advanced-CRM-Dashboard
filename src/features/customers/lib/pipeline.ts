import {
  CUSTOMER_STATUSES,
  DEFAULT_CUSTOMER_LIST_PARAMS,
  MAX_PAGE_SIZE,
  type Customer,
  type CustomerFilters,
  type CustomerListParams,
  type CustomerStatus,
} from "../types";
import type { MoveCustomerInput } from "./schemas";

// Pure helpers for the pipeline board. A board is the customer list ordered by
// `pipelineRank`; the array order within each status is the column order.

/** Card ids per status column, top to bottom. */
export type BoardColumns = Record<CustomerStatus, string[]>;

/** The list query behind the board: every matching customer, in board order. */
export function toBoardParams(
  search: string,
  filters: CustomerFilters,
): CustomerListParams {
  return {
    ...DEFAULT_CUSTOMER_LIST_PARAMS,
    search,
    filters,
    sortBy: "pipelineRank",
    sortOrder: "asc",
    page: 1,
    pageSize: MAX_PAGE_SIZE,
  };
}

const COLUMN_PREFIX = "column:";

/** Droppable id of a whole column, used when dropping into empty space. */
export function columnDropId(status: CustomerStatus) {
  return `${COLUMN_PREFIX}${status}`;
}

export function toColumns(customers: readonly Customer[]): BoardColumns {
  const columns = Object.fromEntries(
    CUSTOMER_STATUSES.map((status) => [status, [] as string[]]),
  ) as BoardColumns;
  for (const customer of customers) columns[customer.status].push(customer.id);
  return columns;
}

/** The column a card id or a column drop id belongs to. */
export function findColumn(
  columns: BoardColumns,
  id: string,
): CustomerStatus | undefined {
  if (id.startsWith(COLUMN_PREFIX)) {
    const status = id.slice(COLUMN_PREFIX.length);
    return CUSTOMER_STATUSES.find((candidate) => candidate === status);
  }
  return CUSTOMER_STATUSES.find((status) => columns[status].includes(id));
}

/**
 * Places a card where `overId` is: at that card's position, or at the end of
 * the column when `overId` is the column itself. Works within and across columns.
 */
export function placeCard(
  columns: BoardColumns,
  cardId: string,
  overId: string,
): BoardColumns {
  const from = findColumn(columns, cardId);
  const to = findColumn(columns, overId);
  if (!from || !to || cardId === overId) return columns;

  // The hovered card's index before anything moves. Within a column this is
  // the "array move" position: dragging down lands after the hovered card,
  // because the cards in between shift up to fill the gap.
  const overIndex = columns[to].indexOf(overId);
  const next = { ...columns, [from]: columns[from].filter((id) => id !== cardId) };
  const target = next[to];
  const index = overIndex === -1 ? target.length : overIndex;

  next[to] = [...target.slice(0, index), cardId, ...target.slice(index)];
  return next;
}

/** The move request that puts a card where it currently sits in `columns`. */
export function toMoveInput(
  columns: BoardColumns,
  cardId: string,
): MoveCustomerInput | undefined {
  const status = findColumn(columns, cardId);
  if (!status) return undefined;
  const index = columns[status].indexOf(cardId);
  return { status, beforeId: columns[status][index + 1] ?? null };
}

/** Applies a move to a board-ordered customer list, as the server would. */
export function applyMove(
  customers: readonly Customer[],
  customerId: string,
  { status, beforeId }: MoveCustomerInput,
): Customer[] {
  const moving = customers.find((customer) => customer.id === customerId);
  if (!moving) return [...customers];

  const rest = customers.filter((customer) => customer.id !== customerId);
  const moved: Customer = { ...moving, status };
  const index = beforeId ? rest.findIndex((c) => c.id === beforeId) : -1;
  // Appending keeps it last in its column, since columns are read in list order.
  if (index === -1) return [...rest, moved];
  return [...rest.slice(0, index), moved, ...rest.slice(index)];
}
