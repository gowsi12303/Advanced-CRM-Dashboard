"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRightIcon, EyeIcon, GripVerticalIcon, MoreHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  type Customer,
  type CustomerStatus,
} from "../../types";
import { CustomerStatusBadge } from "../customer-status-badge";

type CardBodyProps = {
  customer: Customer;
  /** Slot for the drag handle, so the overlay copy can show a static one. */
  handle: React.ReactNode;
  onOpen?: (customer: Customer) => void;
  onMoveTo?: (customer: Customer, status: CustomerStatus) => void;
  className?: string;
};

/** The card's content, shared by the sortable card and its drag overlay copy. */
export function PipelineCardBody({
  customer,
  handle,
  onOpen,
  onMoveTo,
  className,
}: CardBodyProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 text-card-foreground shadow-xs",
        className,
      )}
    >
      <div className="flex items-start gap-1.5">
        {handle}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpen?.(customer)}
            className="block max-w-full truncate rounded-sm text-left text-sm font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {customer.name}
          </button>
          <p className="truncate text-xs text-muted-foreground">
            {[customer.jobTitle, customer.company].filter(Boolean).join(" · ")}
          </p>
        </div>
        {onMoveTo && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" className="-mt-0.5 -mr-1 shrink-0">
                <MoreHorizontalIcon />
                <span className="sr-only">Actions for {customer.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => onOpen?.(customer)}>
                <EyeIcon />
                View details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {CUSTOMER_STATUSES.filter((status) => status !== customer.status).map(
                (status) => (
                  <DropdownMenuItem
                    key={status}
                    onSelect={() => onMoveTo(customer, status)}
                  >
                    <ArrowRightIcon />
                    {CUSTOMER_STATUS_LABELS[status]}
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <p className="mt-2 truncate text-xs text-muted-foreground">{customer.email}</p>
      {/* Wraps onto two lines in a narrow column instead of cutting the date off. */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <CustomerStatusBadge status={customer.status} />
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {customer.lastContactedAt
            ? `Contacted ${formatDate(customer.lastContactedAt)}`
            : "Never contacted"}
        </span>
      </div>
    </div>
  );
}

const HANDLE_CLASSES =
  "-ml-1 flex h-6 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground";

/** A handle that looks the part but does nothing, for the drag overlay copy. */
export function StaticDragHandle() {
  return (
    <span className={HANDLE_CLASSES} aria-hidden>
      <GripVerticalIcon className="size-4" />
    </span>
  );
}

type PipelineCardProps = {
  customer: Customer;
  onOpen: (customer: Customer) => void;
  onMoveTo: (customer: Customer, status: CustomerStatus) => void;
};

export function PipelineCard({ customer, onOpen, onMoveTo }: PipelineCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: customer.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-customer-id={customer.id}
      // While dragged, the card stays in the list as a faded placeholder that
      // marks where it will land; the overlay copy follows the pointer.
      className={cn("list-none", isDragging && "opacity-40")}
    >
      <PipelineCardBody
        customer={customer}
        onOpen={onOpen}
        onMoveTo={onMoveTo}
        className={cn(isDragging && "border-dashed border-primary/60")}
        handle={
          // Only the handle starts a drag, so the rest of the card stays
          // clickable and a touch on it scrolls the column.
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Move ${customer.name}`}
            className={cn(
              HANDLE_CLASSES,
              "cursor-grab touch-none outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing",
            )}
          >
            <GripVerticalIcon className="size-4" />
          </button>
        }
      />
    </li>
  );
}
