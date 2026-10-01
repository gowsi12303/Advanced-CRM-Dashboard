import { z } from "zod";

import {
  CONTACT_METHODS,
  CUSTOMER_STATUSES,
  DATE_FILTER_FIELDS,
  MAX_PAGE_SIZE,
} from "../types";

// Shared by the API route handlers and the client-side forms, so both sides
// enforce exactly the same rules.

const PHONE_PATTERN = /^\+?[\d\s().-]+$/;

function countDigits(value: string) {
  return value.replace(/\D/g, "").length;
}

export const customerInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be at most 80 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required")
    .max(120, "Email must be at most 120 characters")
    .pipe(z.email("Enter a valid email address")),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .regex(PHONE_PATTERN, "Use digits, spaces and + ( ) - . only")
    .refine((value) => {
      const digits = countDigits(value);
      return digits >= 7 && digits <= 15;
    }, "Phone number must contain 7 to 15 digits"),
  company: z
    .string()
    .trim()
    .min(1, "Company is required")
    .max(80, "Company must be at most 80 characters"),
  jobTitle: z
    .string()
    .trim()
    .max(80, "Job title must be at most 80 characters")
    .optional(),
  status: z.enum(CUSTOMER_STATUSES, "Select a status"),
});
export type CustomerInput = z.infer<typeof customerInputSchema>;

export const customerUpdateSchema = customerInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "No changes provided");
export type CustomerUpdate = z.infer<typeof customerUpdateSchema>;

export const noteInputSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Note cannot be empty")
    .max(2000, "Note must be at most 2000 characters"),
});
export type NoteInput = z.infer<typeof noteInputSchema>;

export const contactLogSchema = z.object({
  method: z.enum(CONTACT_METHODS, "Select a contact method"),
  /** ISO timestamp; defaults to "now" on the server when omitted. */
  contactedAt: z.iso
    .datetime("Enter a valid date and time")
    .refine(
      // Allow a minute of clock skew between client and server.
      (value) => new Date(value).getTime() <= Date.now() + 60_000,
      "Contact date cannot be in the future",
    )
    .optional(),
  /** Optional summary, saved as a note on the customer. */
  note: z
    .string()
    .trim()
    .max(2000, "Note must be at most 2000 characters")
    .optional(),
});
export type ContactLogInput = z.infer<typeof contactLogSchema>;

/**
 * The "Log contact" form. It differs from the API payload only in the date,
 * which a `datetime-local` input reports as local time without a timezone.
 */
export const contactFormSchema = z.object({
  method: z.enum(CONTACT_METHODS, "Select a contact method"),
  contactedAt: z
    .string()
    .min(1, "Enter the date and time of the contact")
    .refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      "Enter a valid date and time",
    )
    .refine(
      (value) => new Date(value).getTime() <= Date.now() + 60_000,
      "Contact date cannot be in the future",
    ),
  note: z.string().trim().max(2000, "Note must be at most 2000 characters"),
});
export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const moveCustomerSchema = z.object({
  status: z.enum(CUSTOMER_STATUSES),
  /** Place the customer before this one in the column, or last when null. */
  beforeId: z.string().min(1).nullable(),
});
export type MoveCustomerInput = z.infer<typeof moveCustomerSchema>;

const idsSchema = z
  .array(z.string().min(1))
  .min(1, "Select at least one customer")
  .max(MAX_PAGE_SIZE);

export const bulkActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete"), ids: idsSchema }),
  z.object({
    action: z.literal("updateStatus"),
    ids: idsSchema,
    status: z.enum(CUSTOMER_STATUSES),
  }),
]);
export type BulkAction = z.infer<typeof bulkActionSchema>;

const dateOnlySchema = z.iso.date("Use the yyyy-MM-dd date format");

export const customerFiltersSchema = z
  .object({
    status: z.array(z.enum(CUSTOMER_STATUSES)),
    companies: z.array(z.string().min(1).max(80)).max(100),
    dateField: z.enum(DATE_FILTER_FIELDS),
    dateFrom: dateOnlySchema.nullable(),
    dateTo: dateOnlySchema.nullable(),
    includeNeverContacted: z.boolean(),
    email: z.string().trim().max(120),
    phone: z.string().trim().max(30),
  })
  .refine(
    (value) =>
      !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
    { path: ["dateTo"], message: "End date must be on or after the start date" },
  );

export const savedFilterNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(50, "Name must be at most 50 characters");

export const savedFilterInputSchema = z.object({
  name: savedFilterNameSchema,
  filters: customerFiltersSchema,
});
export type SavedFilterInput = z.infer<typeof savedFilterInputSchema>;

export const savedFilterUpdateSchema = z
  .object({
    name: savedFilterNameSchema.optional(),
    filters: customerFiltersSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes provided");
export type SavedFilterUpdate = z.infer<typeof savedFilterUpdateSchema>;
