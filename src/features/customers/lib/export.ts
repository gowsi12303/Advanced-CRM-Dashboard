import { toCsv } from "@/lib/csv";
import { toDateTimeLocalValue, toLocalDateOnly } from "@/lib/format";

import {
  CONTACT_METHOD_LABELS,
  CUSTOMER_STATUS_LABELS,
  type Customer,
} from "../types";

export const CUSTOMER_CSV_HEADERS = [
  "Name",
  "Email",
  "Phone",
  "Company",
  "Job title",
  "Status",
  "Last contact",
  "Last contact method",
  "Created",
] as const;

/** Customers as CSV text. Dates are in the viewer's time zone, as on screen. */
export function customersToCsv(customers: readonly Customer[]): string {
  return toCsv(
    CUSTOMER_CSV_HEADERS,
    customers.map((customer) => [
      customer.name,
      customer.email,
      customer.phone,
      customer.company,
      customer.jobTitle,
      CUSTOMER_STATUS_LABELS[customer.status],
      customer.lastContactedAt
        ? toDateTimeLocalValue(new Date(customer.lastContactedAt)).replace("T", " ")
        : "",
      customer.lastContactMethod
        ? CONTACT_METHOD_LABELS[customer.lastContactMethod]
        : "",
      toLocalDateOnly(new Date(customer.createdAt)),
    ]),
  );
}

/** e.g. `customers-2026-10-01.csv`, or `customers-filtered-…` for a narrowed list. */
export function customersCsvFilename(now: Date, isNarrowed: boolean) {
  return `customers-${isNarrowed ? "filtered-" : ""}${toLocalDateOnly(now)}.csv`;
}
