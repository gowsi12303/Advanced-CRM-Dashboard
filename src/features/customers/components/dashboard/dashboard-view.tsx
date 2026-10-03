"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BellRingIcon,
  PhoneCallIcon,
  TargetIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api-client";
import { formatDate, formatNumber, toLocalDateOnly } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useCustomerCount, useCustomers } from "../../hooks/use-customers";
import { FILTER_TEMPLATES } from "../../lib/filter-templates";
import { toPageSearchParams } from "../../lib/list-params";
import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  DEFAULT_CUSTOMER_LIST_PARAMS,
  EMPTY_CUSTOMER_FILTERS,
  type CustomerFilters,
  type CustomerStatus,
} from "../../types";
import { CustomerAvatar } from "../customer-avatar";
import { CustomerStatusBadge, STATUS_DOT_CLASSES } from "../customer-status-badge";

const RECENT_COUNT = 5;

/** The Customers page with a filter set applied. */
function customersHref(filters: CustomerFilters) {
  const query = toPageSearchParams({
    ...DEFAULT_CUSTOMER_LIST_PARAMS,
    filters,
  }).toString();
  return query ? `/customers?${query}` : "/customers";
}

const statusFilters = (status: CustomerStatus): CustomerFilters => ({
  ...EMPTY_CUSTOMER_FILTERS,
  status: [status],
});

type Count = ReturnType<typeof useCustomerCount>;

type StatCardProps = {
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon tile. */
  tone: string;
  count: Count;
  href: string;
};

/** A headline number that links to the customers behind it. */
function StatCard({ label, hint, icon: Icon, tone, count, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs outline-none transition-colors hover:border-ring/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", tone)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      {count.isPending ? (
        <Skeleton className="h-9 w-20" aria-label={`Loading ${label.toLowerCase()}`} />
      ) : (
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {count.isError ? "—" : formatNumber(count.data)}
        </span>
      )}
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {hint}
        <ArrowRightIcon
          className="size-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      </span>
    </Link>
  );
}

export function DashboardView() {
  // Read once, so the "this week" boundary doesn't move while the page is open.
  const [now] = useState(() => new Date());
  const [weekFilters] = useState<CustomerFilters>(() => ({
    ...EMPTY_CUSTOMER_FILTERS,
    dateField: "lastContactedAt",
    // The last seven days, today included.
    dateFrom: toLocalDateOnly(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6),
    ),
  }));
  const [followUpFilters] = useState<CustomerFilters>(() => {
    const template = FILTER_TEMPLATES.find((item) => item.id === "no-contact-30-days");
    return template ? template.build(now) : EMPTY_CUSTOMER_FILTERS;
  });

  const total = useCustomerCount(EMPTY_CUSTOMER_FILTERS);
  const contactedThisWeek = useCustomerCount(weekFilters);
  const needFollowUp = useCustomerCount(followUpFilters);
  // One count per status. The hook is called a fixed number of times, in a
  // fixed order, because the status list is a constant.
  const byStatus = {
    lead: useCustomerCount(statusFilters("lead")),
    prospect: useCustomerCount(statusFilters("prospect")),
    active: useCustomerCount(statusFilters("active")),
    inactive: useCustomerCount(statusFilters("inactive")),
    churned: useCustomerCount(statusFilters("churned")),
  } satisfies Record<CustomerStatus, Count>;
  const recent = useCustomers(DEFAULT_CUSTOMER_LIST_PARAMS);

  const counts = [total, contactedThisWeek, needFollowUp, ...Object.values(byStatus)];
  const failed = counts.find((count) => count.isError);
  const largest = Math.max(1, ...CUSTOMER_STATUSES.map((s) => byStatus[s].data ?? 0));

  return (
    <div className="flex flex-1 flex-col gap-6">
      {failed && (
        <ErrorState
          title="Couldn't load the dashboard"
          message={getErrorMessage(failed.error)}
          onRetry={() => {
            counts.forEach((count) => {
              if (count.isError) void count.refetch();
            });
            if (recent.isError) void recent.refetch();
          }}
          isRetrying={counts.some((count) => count.isFetching)}
          className="flex-none"
        />
      )}

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total customers"
          hint="View all customers"
          icon={UsersIcon}
          tone="bg-sky-500/15 text-sky-700 dark:text-sky-300"
          count={total}
          href="/customers"
        />
        <StatCard
          label="Active leads"
          hint="Customers in the Lead stage"
          icon={TargetIcon}
          tone="bg-amber-500/15 text-amber-700 dark:text-amber-300"
          count={byStatus.lead}
          href={customersHref(statusFilters("lead"))}
        />
        <StatCard
          label="Contacted this week"
          hint="Last contact in the past 7 days"
          icon={PhoneCallIcon}
          tone="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          count={contactedThisWeek}
          href={customersHref(weekFilters)}
        />
        <StatCard
          label="Need follow-up"
          hint="No contact in 30 days, or never"
          icon={BellRingIcon}
          tone="bg-rose-500/15 text-rose-700 dark:text-rose-300"
          count={needFollowUp}
          href={customersHref(followUpFilters)}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section
          aria-labelledby="dashboard-status-heading"
          className="rounded-xl border bg-card p-4 shadow-xs lg:col-span-2"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 id="dashboard-status-heading" className="text-sm font-semibold">
              Customers by status
            </h2>
            <Link
              href="/pipeline"
              className="rounded-sm text-xs font-medium text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Open pipeline
            </Link>
          </div>
          <ul className="space-y-3">
            {CUSTOMER_STATUSES.map((status) => {
              const count = byStatus[status];
              return (
                <li key={status}>
                  <Link
                    href={customersHref(statusFilters(status))}
                    className="block rounded-md p-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={cn("size-2 rounded-full", STATUS_DOT_CLASSES[status])}
                        />
                        {CUSTOMER_STATUS_LABELS[status]}
                      </span>
                      {count.isPending ? (
                        <Skeleton className="h-4 w-8" />
                      ) : (
                        <span className="font-medium tabular-nums">
                          {count.isError ? "—" : formatNumber(count.data)}
                        </span>
                      )}
                    </div>
                    {/* The bar repeats the number beside it, so it is decorative. */}
                    <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-[width]", STATUS_DOT_CLASSES[status])}
                        style={{ width: `${((count.data ?? 0) / largest) * 100}%` }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          aria-labelledby="dashboard-recent-heading"
          className="rounded-xl border bg-card p-4 shadow-xs lg:col-span-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="dashboard-recent-heading" className="text-sm font-semibold">
              Recently added
            </h2>
            <Link
              href="/customers"
              className="rounded-sm text-xs font-medium text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              View all
            </Link>
          </div>
          {recent.isPending ? (
            <div className="space-y-3 pt-2" aria-busy aria-label="Loading recent customers">
              {Array.from({ length: RECENT_COUNT }, (_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : recent.isError ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Recent customers could not be loaded.
            </p>
          ) : recent.data.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No customers yet.
            </p>
          ) : (
            <ul className="divide-y">
              {recent.data.items.slice(0, RECENT_COUNT).map((customer) => (
                <li key={customer.id} className="flex items-center gap-3 py-2.5">
                  <CustomerAvatar name={customer.name} />
                  <div className="min-w-0 flex-1">
                    {/* Opens the customer's drawer on the Customers page. */}
                    <Link
                      href={`/customers?customer=${encodeURIComponent(customer.id)}`}
                      className="block truncate rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {customer.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {customer.company}
                    </p>
                  </div>
                  <CustomerStatusBadge status={customer.status} />
                  <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground sm:block">
                    {formatDate(customer.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
