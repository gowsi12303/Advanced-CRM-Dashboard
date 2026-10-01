"use client";

import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { getErrorMessage } from "@/lib/api-client";

import { useDeleteCustomer } from "../../hooks/use-customer-mutations";
import type { CustomerRef } from "./log-contact-dialog";

type DeleteCustomerDialogProps = {
  /** Null while closed. */
  customer: CustomerRef | null;
  onClose: () => void;
  onDeleted?: (customerId: string) => void;
};

export function DeleteCustomerDialog({
  customer,
  onClose,
  onDeleted,
}: DeleteCustomerDialogProps) {
  const deleteCustomer = useDeleteCustomer();

  const handleConfirm = () => {
    if (!customer) return;
    deleteCustomer.mutate(customer.id, {
      onSuccess: () => {
        onClose();
        onDeleted?.(customer.id);
        toast.success(`Deleted ${customer.name}`);
      },
      // The dialog stays open so the user can try again or cancel.
      onError: (error) =>
        toast.error(`Couldn't delete ${customer.name}`, {
          description: getErrorMessage(error),
        }),
    });
  };

  return (
    <ConfirmDialog
      open={customer !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Delete customer?"
      description={
        <>
          This permanently deletes{" "}
          <span className="font-medium text-foreground">{customer?.name}</span>{" "}
          and all of their notes. This can&apos;t be undone.
        </>
      }
      confirmLabel="Delete customer"
      pendingLabel="Deleting…"
      isPending={deleteCustomer.isPending}
      onConfirm={handleConfirm}
      destructive
    />
  );
}
