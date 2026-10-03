import { cn } from "@/lib/utils";

import { CUSTOMER_STATUS_LABELS, type CustomerStatus } from "../types";

/** The solid colour that stands for each status (dots, bars). */
export const STATUS_DOT_CLASSES: Record<CustomerStatus, string> = {
  lead: "bg-sky-500",
  prospect: "bg-amber-500",
  active: "bg-emerald-500",
  inactive: "bg-slate-400",
  churned: "bg-rose-500",
};

// A soft tint of the status colour with darker (light theme) or lighter (dark
// theme) text, chosen to keep at least 4.5:1 contrast on the tint.
const STATUS_PILL_CLASSES: Record<CustomerStatus, string> = {
  lead: "border-sky-500/25 bg-sky-500/12 text-sky-800 dark:text-sky-300",
  prospect: "border-amber-500/25 bg-amber-500/12 text-amber-800 dark:text-amber-300",
  active: "border-emerald-500/25 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
  inactive: "border-slate-500/25 bg-slate-500/12 text-slate-700 dark:text-slate-300",
  churned: "border-rose-500/25 bg-rose-500/12 text-rose-800 dark:text-rose-300",
};

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_PILL_CLASSES[status],
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", STATUS_DOT_CLASSES[status])}
      />
      {CUSTOMER_STATUS_LABELS[status]}
    </span>
  );
}
