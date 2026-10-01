"use client";

import { useCallback, useState } from "react";

import { useUrlParam } from "@/lib/use-url-param";

import type { Customer } from "../../types";
import type { CustomerRowAction } from "../customer-row-actions";
import { CustomerDetailsSheet } from "./customer-details-sheet";
import {
  CustomerFormDialog,
  type CustomerFormMode,
} from "./customer-form-dialog";
import { DeleteCustomerDialog } from "./delete-customer-dialog";
import { LogContactDialog, type CustomerRef } from "./log-contact-dialog";

// Only ids and names are kept here. The dialogs read everything else from the
// query cache, so they always show current data.
type ActiveDialog =
  | CustomerFormMode
  | { type: "logContact"; customer: CustomerRef }
  | { type: "delete"; customer: CustomerRef };

/** Which customer dialog or drawer is open, and the handlers that open them. */
export function useCustomerActions() {
  // Which customer's drawer is open is kept in the URL (`?customer=<id>`), so
  // it survives a reload, can be shared as a link, and Back closes it.
  const [detailsId, setDetailsId] = useUrlParam("customer");
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);

  /** Single entry point for the row menu, the name link and the details drawer. */
  const handleAction = useCallback(
    (action: CustomerRowAction, { id, name }: Customer) => {
      switch (action) {
        case "view":
          setDetailsId(id);
          break;
        case "edit":
          setDialog({ type: "edit", customerId: id });
          break;
        case "logContact":
          setDialog({ type: "logContact", customer: { id, name } });
          break;
        case "delete":
          setDialog({ type: "delete", customer: { id, name } });
          break;
      }
    },
    [setDetailsId],
  );

  const openCreate = useCallback(() => setDialog({ type: "create" }), []);
  const closeDialog = useCallback(() => setDialog(null), []);
  const closeDetails = useCallback(() => setDetailsId(null), [setDetailsId]);

  return {
    detailsId,
    dialog,
    handleAction,
    openCreate,
    openDetails: setDetailsId,
    closeDialog,
    closeDetails,
  };
}

type CustomerActionDialogsProps = {
  actions: ReturnType<typeof useCustomerActions>;
};

/** Renders every customer dialog; mount once next to the customer list. */
export function CustomerActionDialogs({ actions }: CustomerActionDialogsProps) {
  const { detailsId, dialog, handleAction, openDetails, closeDialog, closeDetails } =
    actions;

  return (
    <>
      <CustomerDetailsSheet
        customerId={detailsId}
        onClose={closeDetails}
        onAction={handleAction}
      />
      <CustomerFormDialog
        mode={dialog?.type === "create" || dialog?.type === "edit" ? dialog : null}
        onClose={closeDialog}
        onViewCreated={(customer) => openDetails(customer.id)}
      />
      <LogContactDialog
        customer={dialog?.type === "logContact" ? dialog.customer : null}
        onClose={closeDialog}
      />
      <DeleteCustomerDialog
        customer={dialog?.type === "delete" ? dialog.customer : null}
        onClose={closeDialog}
        onDeleted={(customerId) => {
          // The drawer may be showing the customer that was just deleted.
          if (customerId === detailsId) closeDetails();
        }}
      />
    </>
  );
}
