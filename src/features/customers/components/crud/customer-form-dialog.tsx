"use client";

import { toast } from "sonner";

import { ErrorState } from "@/components/shared/error-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api-client";
import { useReturnFocus } from "@/lib/use-return-focus";

import {
  useCreateCustomer,
  useUpdateCustomer,
} from "../../hooks/use-customer-mutations";
import { useCustomer } from "../../hooks/use-customers";
import type { Customer } from "../../types";
import { CustomerForm, EMPTY_CUSTOMER_FORM_VALUES } from "./customer-form";

export type CustomerFormMode =
  | { type: "create" }
  | { type: "edit"; customerId: string };

type CustomerFormDialogProps = {
  /** Null while closed. */
  mode: CustomerFormMode | null;
  onClose: () => void;
  /** Opens a newly added customer; offered as a "View" action on the success toast. */
  onViewCreated?: (customer: Customer) => void;
};

function CreateCustomerForm({
  onClose,
  onViewCreated,
}: Pick<CustomerFormDialogProps, "onClose" | "onViewCreated">) {
  const createCustomer = useCreateCustomer();

  return (
    <CustomerForm
      defaultValues={EMPTY_CUSTOMER_FORM_VALUES}
      submitLabel="Add customer"
      pendingLabel="Adding…"
      onCancel={onClose}
      onSubmit={async (values) => {
        try {
          const customer = await createCustomer.mutateAsync(values);
          onClose();
          toast.success(`Added ${customer.name}`, {
            // The new customer may be outside the current search or filters.
            action: onViewCreated && {
              label: "View",
              onClick: () => onViewCreated(customer),
            },
          });
        } catch (error) {
          toast.error("Couldn't add the customer", {
            description: getErrorMessage(error),
          });
          throw error;
        }
      }}
    />
  );
}

function EditCustomerForm({
  customerId,
  onClose,
}: {
  customerId: string;
  onClose: () => void;
}) {
  const customer = useCustomer(customerId);
  const updateCustomer = useUpdateCustomer();

  if (customer.isPending) {
    return (
      <div className="grid gap-4" aria-busy aria-label="Loading customer">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="grid gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (customer.isError) {
    return (
      <ErrorState
        title="Couldn't load this customer"
        message={getErrorMessage(customer.error)}
        onRetry={() => customer.refetch()}
        isRetrying={customer.isFetching}
        className="border-0 p-4"
      />
    );
  }

  const { name, email, phone, company, jobTitle, status } = customer.data;

  return (
    <CustomerForm
      defaultValues={{ name, email, phone, company, jobTitle, status }}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      onCancel={onClose}
      onSubmit={async (values) => {
        try {
          const updated = await updateCustomer.mutateAsync({
            id: customerId,
            input: values,
          });
          onClose();
          toast.success(`Saved changes to ${updated.name}`);
        } catch (error) {
          toast.error("Couldn't save the changes", {
            description: getErrorMessage(error),
          });
          throw error;
        }
      }}
    />
  );
}

export function CustomerFormDialog({
  mode,
  onClose,
  onViewCreated,
}: CustomerFormDialogProps) {
  const isEdit = mode?.type === "edit";
  const returnFocus = useReturnFocus(mode !== null);

  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
        onCloseAutoFocus={returnFocus}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this customer's details."
              : "Create a new customer record."}{" "}
            Fields marked <span className="text-destructive">*</span> are required.
          </DialogDescription>
        </DialogHeader>
        {mode?.type === "create" && (
          <CreateCustomerForm onClose={onClose} onViewCreated={onViewCreated} />
        )}
        {mode?.type === "edit" && (
          <EditCustomerForm customerId={mode.customerId} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
