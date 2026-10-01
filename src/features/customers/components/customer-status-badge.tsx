import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { CUSTOMER_STATUS_LABELS, type CustomerStatus } from "../types";

export const STATUS_DOT_CLASSES: Record<CustomerStatus, string> = {
  lead: "bg-sky-500",
  prospect: "bg-amber-500",
  active: "bg-emerald-500",
  inactive: "bg-zinc-400",
  churned: "bg-rose-500",
};

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", STATUS_DOT_CLASSES[status])}
      />
      {CUSTOMER_STATUS_LABELS[status]}
    </Badge>
  );
}
