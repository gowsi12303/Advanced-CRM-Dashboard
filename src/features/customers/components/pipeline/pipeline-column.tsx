"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { columnDropId } from "../../lib/pipeline";
import {
  CUSTOMER_STATUS_LABELS,
  type Customer,
  type CustomerStatus,
} from "../../types";
import { STATUS_DOT_CLASSES } from "../customer-status-badge";
import { PipelineCard } from "./pipeline-card";

type PipelineColumnProps = {
  status: CustomerStatus;
  customers: Customer[];
  /** True while a dragged card is currently placed in this column. */
  isDropTarget: boolean;
  onOpen: (customer: Customer) => void;
  onMoveTo: (customer: Customer, status: CustomerStatus) => void;
};

export function PipelineColumn({
  status,
  customers,
  isDropTarget,
  onOpen,
  onMoveTo,
}: PipelineColumnProps) {
  // The column itself is a drop target so cards can be dropped into empty space.
  const { setNodeRef } = useDroppable({ id: columnDropId(status) });
  const label = CUSTOMER_STATUS_LABELS[status];

  return (
    <section
      aria-label={`${label}, ${customers.length} ${customers.length === 1 ? "customer" : "customers"}`}
      data-status={status}
      className={cn(
        // Phones show roughly one column at a time and scroll sideways; wide
        // containers share the width between all five.
        "flex w-[82vw] max-w-72 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors sm:w-64",
        "@5xl:w-auto @5xl:max-w-none @5xl:min-w-0 @5xl:flex-1",
        isDropTarget && "border-primary/50 bg-primary/10",
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span
          aria-hidden
          className={cn("size-2 rounded-full", STATUS_DOT_CLASSES[status])}
        />
        <h2 className="text-sm font-semibold">{label}</h2>
        <Badge variant="secondary" className="ml-auto tabular-nums">
          {customers.length}
        </Badge>
      </header>

      <SortableContext
        items={customers.map((customer) => customer.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul
          ref={setNodeRef}
          aria-label={`${label} customers`}
          className="relative flex max-h-[calc(100dvh-17rem)] min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2 pt-0"
        >
          {customers.map((customer) => (
            <PipelineCard
              key={customer.id}
              customer={customer}
              onOpen={onOpen}
              onMoveTo={onMoveTo}
            />
          ))}
          {customers.length === 0 && (
            <li className="flex flex-1 list-none items-center justify-center rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              {isDropTarget ? "Drop here" : "No customers"}
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}
