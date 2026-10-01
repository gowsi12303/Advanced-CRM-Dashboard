"use client";

import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import type { MoveCustomerInput } from "../../lib/schemas";
import {
  findColumn,
  placeCard,
  toColumns,
  toMoveInput,
  type BoardColumns,
} from "../../lib/pipeline";
import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  type Customer,
  type CustomerStatus,
} from "../../types";
import { PipelineCardBody, StaticDragHandle } from "./pipeline-card";
import { PipelineColumn } from "./pipeline-column";

type PipelineBoardProps = {
  /** Matching customers in board order (by pipeline rank). */
  customers: Customer[];
  /** Persists a move; the caller updates the list optimistically. */
  onMove: (customer: Customer, input: MoveCustomerInput) => void;
  onOpen: (customer: Customer) => void;
};

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    "To move a customer, press Space or Enter on its move handle. Use the arrow keys to change its position or column, press Space or Enter again to drop it, or press Escape to cancel.",
};

export function PipelineBoard({ customers, onMove, onOpen }: PipelineBoardProps) {
  const sensors = useSensors(
    // A small distance threshold keeps a plain click on the handle from
    // starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byId = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const serverColumns = useMemo(() => toColumns(customers), [customers]);

  // While a card is being dragged, `draft` holds the arrangement the user is
  // previewing. After a drop it is kept until the customer list changes, which
  // is when the optimistic cache update (delivered a tick later) arrives. That
  // way the card never flashes back to its old place. The committed order
  // always comes from the query cache.
  const [draft, setDraft] = useState<BoardColumns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [renderedCustomers, setRenderedCustomers] = useState(customers);
  if (customers !== renderedCustomers) {
    setRenderedCustomers(customers);
    if (!activeId) setDraft(null);
  }
  const columns = draft ?? serverColumns;
  const active = activeId ? byId.get(activeId) : undefined;
  const activeColumn = activeId ? findColumn(columns, activeId) : undefined;

  const reset = () => {
    setDraft(null);
    setActiveId(null);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    // Continue from a just-dropped arrangement if its cache update has not
    // been delivered yet.
    setDraft((current) => current ?? serverColumns);
  };

  // Moving into another column happens while dragging, so that column's cards
  // make room for the card before it is dropped.
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const cardId = String(active.id);
    const overId = String(over.id);
    setDraft((current) => {
      const base = current ?? serverColumns;
      if (findColumn(base, cardId) === findColumn(base, overId)) return current;
      return placeCard(base, cardId, overId);
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const cardId = String(active.id);
    const customer = byId.get(cardId);
    const base = draft ?? serverColumns;
    setActiveId(null);
    // Dropped outside every column: leave the board as it was.
    if (!over || !customer) {
      setDraft(null);
      return;
    }

    const final = placeCard(base, cardId, String(over.id));
    const target = toMoveInput(final, cardId);
    const original = toMoveInput(serverColumns, cardId);
    if (
      !target ||
      (target.status === original?.status && target.beforeId === original.beforeId)
    ) {
      setDraft(null);
      return;
    }
    setDraft(final);
    onMove(customer, target);
  };

  const moveToColumn = (customer: Customer, status: CustomerStatus) => {
    onMove(customer, { status, beforeId: null });
  };

  const describe = (id: string | number) => byId.get(String(id))?.name ?? "Customer";
  const describePosition = (cardId: string | number, overId: string | number) => {
    // Announce where the card would land, using the same rule as the drop.
    const preview = placeCard(columns, String(cardId), String(overId));
    const status = findColumn(preview, String(cardId));
    if (!status) return null;
    const position = preview[status].indexOf(String(cardId)) + 1;
    return `${CUSTOMER_STATUS_LABELS[status]} column, position ${position} of ${preview[status].length}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${describe(active.id)}.`,
    onDragOver: ({ active, over }) => {
      const where = over && describePosition(active.id, over.id);
      return where
        ? `${describe(active.id)} is over the ${where}.`
        : `${describe(active.id)} is not over a column.`;
    },
    onDragEnd: ({ active, over }) => {
      const where = over && describePosition(active.id, over.id);
      return where
        ? `${describe(active.id)} was dropped in the ${where}.`
        : `${describe(active.id)} was returned to its place.`;
    },
    onDragCancel: ({ active }) =>
      `Moving ${describe(active.id)} was cancelled. It was returned to its place.`,
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={reset}
      accessibility={{
        announcements,
        screenReaderInstructions: SCREEN_READER_INSTRUCTIONS,
      }}
    >
      {/* The board scrolls sideways inside this box, so the page never does.
          `relative` matters: without it, visually-hidden (absolutely positioned)
          labels in off-screen columns escape the clipping and widen the page. */}
      <div
        role="group"
        aria-label="Pipeline board"
        className="relative flex min-w-0 flex-1 items-start gap-3 overflow-x-auto pb-2"
      >
        {CUSTOMER_STATUSES.map((status) => (
          <PipelineColumn
            key={status}
            status={status}
            customers={columns[status].flatMap((id) => {
              const customer = byId.get(id);
              return customer ? [customer] : [];
            })}
            isDropTarget={activeColumn === status}
            onOpen={onOpen}
            onMoveTo={moveToColumn}
          />
        ))}
      </div>

      <DragOverlay>
        {active && (
          <PipelineCardBody
            customer={active}
            handle={<StaticDragHandle />}
            // No rotate/scale here: dnd-kit measures this element, and a transform
            // would skew the rectangle that keyboard movement is calculated from.
            className="cursor-grabbing shadow-lg ring-2 ring-primary/40"
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
