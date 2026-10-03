"use client";

import {
  Building2Icon,
  ClockIcon,
  MailIcon,
  PencilIcon,
  PhoneCallIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";

import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/format";
import { useReturnFocus } from "@/lib/use-return-focus";

import { useCustomer } from "../../hooks/use-customers";
import { CONTACT_METHOD_LABELS, type Customer } from "../../types";
import type { CustomerRowAction } from "../customer-row-actions";
import { CustomerAvatar } from "../customer-avatar";
import { CustomerStatusBadge } from "../customer-status-badge";
import { CustomerNotes } from "./customer-notes";

type CustomerDetailsSheetProps = {
  /** Null while closed. */
  customerId: string | null;
  onClose: () => void;
  /** Edit, log contact and delete are handled by the same code as the row menu. */
  onAction: (action: CustomerRowAction, customer: Customer) => void;
};

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3.5" aria-hidden />
        {title}
      </h3>
      <dl>{children}</dl>
    </section>
  );
}

function CustomerDetails({
  customer,
  onAction,
}: {
  customer: Customer;
  onAction: CustomerDetailsSheetProps["onAction"];
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onAction("logContact", customer)}>
          <PhoneCallIcon />
          Log contact
        </Button>
        <Button variant="outline" size="sm" onClick={() => onAction("edit", customer)}>
          <PencilIcon />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction("delete", customer)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2Icon />
          Delete
        </Button>
      </div>

      <div role="group" aria-label="Customer details" className="space-y-3">
        <DetailSection title="Contact information" icon={MailIcon}>
          <Detail label="Email">
            <a href={`mailto:${customer.email}`} className="underline-offset-4 hover:underline">
              {customer.email}
            </a>
          </Detail>
          <Detail label="Phone">
            <a href={`tel:${customer.phone}`} className="underline-offset-4 hover:underline">
              {customer.phone}
            </a>
          </Detail>
        </DetailSection>

        <DetailSection title="Company & status" icon={Building2Icon}>
          <Detail label="Company">{customer.company}</Detail>
          <Detail label="Job title">
            {customer.jobTitle || <span className="text-muted-foreground">Not set</span>}
          </Detail>
          <Detail label="Status">
            <CustomerStatusBadge status={customer.status} />
          </Detail>
        </DetailSection>

        <DetailSection title="Timeline" icon={ClockIcon}>
          <Detail label="Created">{formatDate(customer.createdAt)}</Detail>
          <Detail label="Last contact">
            {customer.lastContactedAt ? (
              formatDateTime(customer.lastContactedAt)
            ) : (
              <span className="text-muted-foreground">Never contacted</span>
            )}
          </Detail>
          <Detail label="Contact method">
            {customer.lastContactMethod ? (
              CONTACT_METHOD_LABELS[customer.lastContactMethod]
            ) : (
              <span className="text-muted-foreground">None yet</span>
            )}
          </Detail>
        </DetailSection>
      </div>

      <CustomerNotes customerId={customer.id} />
    </>
  );
}

function DetailsBody({
  customerId,
  onAction,
}: {
  customerId: string;
  onAction: CustomerDetailsSheetProps["onAction"];
}) {
  const customer = useCustomer(customerId);

  return (
    <>
      <SheetHeader className="flex-row items-center gap-3 border-b pr-12">
        {customer.data ? (
          <CustomerAvatar name={customer.data.name} size="lg" />
        ) : (
          <Skeleton className="size-12 shrink-0 rounded-full" />
        )}
        <div className="min-w-0 space-y-0.5">
          <SheetTitle className="truncate text-lg">
            {customer.data?.name ??
              (customer.isError ? "Customer" : <Skeleton className="h-6 w-40" />)}
          </SheetTitle>
          <SheetDescription className="truncate">
            {customer.data
              ? [customer.data.jobTitle, customer.data.company].filter(Boolean).join(" · ")
              : "Customer details"}
          </SheetDescription>
        </div>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-6">
        {customer.isPending ? (
          <div className="space-y-3" aria-busy aria-label="Loading customer">
            <Skeleton className="h-8 w-56" />
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-5 w-full" />
            ))}
          </div>
        ) : customer.isError ? (
          <ErrorState
            title="Couldn't load this customer"
            message={getErrorMessage(customer.error)}
            onRetry={() => customer.refetch()}
            isRetrying={customer.isFetching}
          />
        ) : (
          <CustomerDetails customer={customer.data} onAction={onAction} />
        )}
      </div>
    </>
  );
}

export function CustomerDetailsSheet({
  customerId,
  onClose,
  onAction,
}: CustomerDetailsSheetProps) {
  const returnFocus = useReturnFocus(customerId !== null);

  return (
    <Sheet
      open={customerId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full gap-0 sm:max-w-lg" onCloseAutoFocus={returnFocus}>
        {customerId && <DetailsBody customerId={customerId} onAction={onAction} />}
      </SheetContent>
    </Sheet>
  );
}
