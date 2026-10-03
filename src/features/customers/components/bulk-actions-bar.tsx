"use client";

import { useState } from "react";
import { ChevronDownIcon, Loader2Icon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getErrorMessage } from "@/lib/api-client";

import { useBulkCustomerAction } from "../hooks/use-customer-mutations";
import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  type Customer,
  type CustomerStatus,
} from "../types";

type BulkActionsBarProps = {
  /** The selected customers, all of them rows currently on screen. */
  selected: Customer[];
  onClear: () => void;
};

const plural = (count: number) => (count === 1 ? "customer" : "customers");

export function BulkActionsBar({ selected, onClear }: BulkActionsBarProps) {
  const bulkAction = useBulkCustomerAction();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const count = selected.length;
  const ids = selected.map((customer) => customer.id);
  const isPending = bulkAction.isPending;
  const pendingAction = isPending ? bulkAction.variables?.action : undefined;

  if (count === 0) return null;

  const changeStatus = (status: CustomerStatus) => {
    const label = CUSTOMER_STATUS_LABELS[status];
    bulkAction.mutate(
      { action: "updateStatus", ids, status },
      {
        onSuccess: ({ affected }) => {
          onClear();
          const unchanged = count - affected;
          toast.success(
            affected === 0
              ? `All ${count} selected ${plural(count)} were already ${label}`
              : `Changed ${affected} ${plural(affected)} to ${label}`,
            unchanged > 0 && affected > 0
              ? { description: `${unchanged} already had that status.` }
              : undefined,
          );
        },
        onError: (error) =>
          toast.error("Couldn't change the status", {
            description: getErrorMessage(error),
          }),
      },
    );
  };

  const deleteSelected = () => {
    bulkAction.mutate(
      { action: "delete", ids },
      {
        onSuccess: ({ affected }) => {
          setIsConfirmingDelete(false);
          onClear();
          toast.success(`Deleted ${affected} ${plural(affected)}`);
        },
        // The dialog stays open so the user can try again or cancel.
        onError: (error) =>
          toast.error(`Couldn't delete the selected ${plural(count)}`, {
            description: getErrorMessage(error),
          }),
      },
    );
  };

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2"
    >
      <div className="mr-auto flex items-center gap-1">
        <p className="text-sm font-medium" aria-live="polite">
          <span className="tabular-nums">{count}</span> selected
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={isPending}
          aria-label="Clear selection"
        >
          <XIcon />
          <span className="hidden sm:inline">Clear selection</span>
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            aria-label={pendingAction === "updateStatus" ? "Updating…" : "Change status"}
          >
            {pendingAction === "updateStatus" && <Loader2Icon className="animate-spin" />}
            {pendingAction === "updateStatus" ? (
              "Updating…"
            ) : (
              <>
                {/* A shorter label keeps the bar on one line on a phone. */}
                <span className="sm:hidden">Status</span>
                <span className="hidden sm:inline">Change status</span>
              </>
            )}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {CUSTOMER_STATUSES.map((status) => (
            <DropdownMenuItem key={status} onSelect={() => changeStatus(status)}>
              {CUSTOMER_STATUS_LABELS[status]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsConfirmingDelete(true)}
        disabled={isPending}
        className="text-destructive hover:text-destructive"
      >
        <Trash2Icon />
        Delete
      </Button>

      <ConfirmDialog
        open={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        title={`Delete ${count} ${plural(count)}?`}
        description={
          <>
            This permanently deletes{" "}
            <span className="font-medium text-foreground">
              {count === 1
                ? selected[0].name
                : count === 2
                  ? `${selected[0].name} and ${selected[1].name}`
                  : `${selected[0].name}, ${selected[1].name} and ${count - 2} more`}
            </span>
            , along with their notes. This can&apos;t be undone.
          </>
        }
        confirmLabel={`Delete ${count} ${plural(count)}`}
        pendingLabel="Deleting…"
        isPending={pendingAction === "delete"}
        onConfirm={deleteSelected}
        destructive
      />
    </div>
  );
}
