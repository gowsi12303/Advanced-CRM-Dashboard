import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  CONTACT_METHOD_LABELS,
  type Customer,
  type CustomerSortField,
  type SortOrder,
} from "../types";
import {
  CustomerRowActions,
  type CustomerRowAction,
} from "./customer-row-actions";
import { CustomerAvatar } from "./customer-avatar";
import { CustomerStatusBadge } from "./customer-status-badge";

// Columns drop out as the viewport narrows; the name cell then shows the
// email and company underneath so nothing essential is lost on a phone.
// These are container queries (the view root is the container), so they track
// the width the table actually has, whether the sidebar is open or collapsed.
const COLUMN_VISIBILITY = {
  email: "hidden @5xl:table-cell",
  phone: "hidden @[84rem]:table-cell",
  company: "hidden @2xl:table-cell",
  lastContact: "hidden @3xl:table-cell",
  created: "hidden @6xl:table-cell",
} as const;

type SortableHeadProps = {
  field: CustomerSortField;
  label: string;
  sortBy: CustomerSortField;
  sortOrder: SortOrder;
  onSort: (field: CustomerSortField) => void;
  className?: string;
};

function SortableHead({
  field,
  label,
  sortBy,
  sortOrder,
  onSort,
  className,
}: SortableHeadProps) {
  const isActive = sortBy === field;
  const Icon = !isActive
    ? ChevronsUpDownIcon
    : sortOrder === "asc"
      ? ArrowUpIcon
      : ArrowDownIcon;

  return (
    <TableHead
      aria-sort={
        !isActive ? "none" : sortOrder === "asc" ? "ascending" : "descending"
      }
      className={className}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "-ml-2 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium tracking-wide uppercase outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon
          aria-hidden
          className={cn("size-3.5", !isActive && "opacity-60")}
        />
      </button>
    </TableHead>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return Array.from({ length: count }, (_, index) => (
    <TableRow key={index} className="hover:bg-transparent">
      <TableCell className="w-8">
        <Skeleton className="size-4" />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="hidden size-8 rounded-full @md:block" />
          <div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-1.5 h-3 w-40 @5xl:hidden" />
          </div>
        </div>
      </TableCell>
      <TableCell className={COLUMN_VISIBILITY.email}>
        <Skeleton className="h-4 w-48" />
      </TableCell>
      <TableCell className={COLUMN_VISIBILITY.phone}>
        <Skeleton className="h-4 w-32" />
      </TableCell>
      <TableCell className={COLUMN_VISIBILITY.company}>
        <Skeleton className="h-4 w-32" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-20 rounded-full" />
      </TableCell>
      <TableCell className={COLUMN_VISIBILITY.lastContact}>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell className={COLUMN_VISIBILITY.created}>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="ml-auto size-8" />
      </TableCell>
    </TableRow>
  ));
}

type CustomersTableProps = {
  /** Undefined while the first page is loading. */
  customers: Customer[] | undefined;
  /** How many placeholder rows to show while loading. */
  skeletonRows: number;
  /** True while showing the previous page's rows during a fetch. */
  isStale: boolean;
  sortBy: CustomerSortField;
  sortOrder: SortOrder;
  onSort: (field: CustomerSortField) => void;
  onAction: (action: CustomerRowAction, customer: Customer) => void;
  /** Ids of the selected rows. Only rows on screen can be selected. */
  selectedIds: ReadonlySet<string>;
  onSelect: (customerId: string, selected: boolean) => void;
  /** Selects or clears every row currently on screen. */
  onSelectAll: (selected: boolean) => void;
};

export function CustomersTable({
  customers,
  skeletonRows,
  isStale,
  sortBy,
  sortOrder,
  onSort,
  onAction,
  selectedIds,
  onSelect,
  onSelectAll,
}: CustomersTableProps) {
  const sort = { sortBy, sortOrder, onSort };
  const isLoading = customers === undefined;
  const selectedCount = customers?.filter((c) => selectedIds.has(c.id)).length ?? 0;
  const allSelected = selectedCount > 0 && selectedCount === customers?.length;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <Table aria-label="Customers" aria-busy={isLoading || isStale}>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-8 pl-4">
              <Checkbox
                checked={
                  allSelected ? true : selectedCount > 0 ? "indeterminate" : false
                }
                onCheckedChange={(checked) => onSelectAll(checked === true)}
                disabled={isLoading || isStale}
                aria-label="Select all customers on this page"
              />
            </TableHead>
            <SortableHead field="name" label="Name" {...sort} />
            <SortableHead
              field="email"
              label="Email"
              className={COLUMN_VISIBILITY.email}
              {...sort}
            />
            <TableHead
              className={cn(
                "text-xs font-medium tracking-wide text-muted-foreground uppercase",
                COLUMN_VISIBILITY.phone,
              )}
            >
              Phone
            </TableHead>
            <SortableHead
              field="company"
              label="Company"
              className={COLUMN_VISIBILITY.company}
              {...sort}
            />
            <SortableHead field="status" label="Status" {...sort} />
            <SortableHead
              field="lastContactedAt"
              label="Last contact"
              className={COLUMN_VISIBILITY.lastContact}
              {...sort}
            />
            <SortableHead
              field="createdAt"
              label="Created"
              className={COLUMN_VISIBILITY.created}
              {...sort}
            />
            <TableHead className="w-12 pr-4">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody
          className={cn(
            "transition-opacity [&_td:first-child]:pl-4 [&_td:last-child]:pr-4",
            isStale && "opacity-50",
          )}
        >
          {isLoading ? (
            <SkeletonRows count={skeletonRows} />
          ) : (
            customers.map((customer) => (
              <TableRow
                key={customer.id}
                data-state={selectedIds.has(customer.id) ? "selected" : undefined}
              >
                <TableCell className="w-8">
                  <Checkbox
                    checked={selectedIds.has(customer.id)}
                    onCheckedChange={(checked) =>
                      onSelect(customer.id, checked === true)
                    }
                    disabled={isStale}
                    aria-label={`Select ${customer.name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {/* Dropped on the narrowest screens, where the name needs the room. */}
                    <CustomerAvatar name={customer.name} className="hidden @md:inline-flex" />
                    {/* Table cells don't shrink to truncate; an explicit cap does. */}
                    <div className="max-w-[8.5rem] min-w-0 @md:max-w-[11rem] @4xl:max-w-[16rem]">
                    <button
                      type="button"
                      onClick={() => onAction("view", customer)}
                      className="block max-w-full truncate rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {customer.name}
                    </button>
                    <div className="truncate text-xs text-muted-foreground @5xl:hidden">
                      {customer.email}
                    </div>
                    <div className="truncate text-xs text-muted-foreground @2xl:hidden">
                      {customer.company}
                    </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-muted-foreground",
                    COLUMN_VISIBILITY.email,
                  )}
                >
                  {customer.email}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-muted-foreground tabular-nums",
                    COLUMN_VISIBILITY.phone,
                  )}
                >
                  {customer.phone}
                </TableCell>
                <TableCell className={COLUMN_VISIBILITY.company}>
                  <div className="max-w-[14rem] truncate">{customer.company}</div>
                  {customer.jobTitle && (
                    <div className="max-w-[14rem] truncate text-xs text-muted-foreground">
                      {customer.jobTitle}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <CustomerStatusBadge status={customer.status} />
                </TableCell>
                <TableCell className={COLUMN_VISIBILITY.lastContact}>
                  {customer.lastContactedAt ? (
                    <>
                      <div>{formatDate(customer.lastContactedAt)}</div>
                      {customer.lastContactMethod && (
                        <div className="text-xs text-muted-foreground">
                          {CONTACT_METHOD_LABELS[customer.lastContactMethod]}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-muted-foreground",
                    COLUMN_VISIBILITY.created,
                  )}
                >
                  {formatDate(customer.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <CustomerRowActions customer={customer} onAction={onAction} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
