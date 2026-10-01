import { apiFetch } from "@/lib/api-client";
import { localTimeZone } from "@/lib/format";

import { toSearchParams } from "../lib/list-params";
import type {
  BulkAction,
  ContactLogInput,
  CustomerInput,
  CustomerUpdate,
  MoveCustomerInput,
  NoteInput,
  SavedFilterInput,
  SavedFilterUpdate,
} from "../lib/schemas";
import type {
  BulkResult,
  Customer,
  CustomerListParams,
  CustomerNote,
  Paginated,
  SavedFilter,
} from "../types";

// The only module that knows the API's URLs. Pointing the app at a real
// backend means changing the paths (or base URL) here and nothing else.

const CUSTOMERS = "/api/customers";
const COMPANIES = "/api/companies";
const SAVED_FILTERS = "/api/saved-filters";

const customerPath = (id: string) => `${CUSTOMERS}/${encodeURIComponent(id)}`;
const notesPath = (id: string) => `${customerPath(id)}/notes`;
const savedFilterPath = (id: string) =>
  `${SAVED_FILTERS}/${encodeURIComponent(id)}`;

export const customersApi = {
  list: (params: CustomerListParams, signal?: AbortSignal) => {
    const searchParams = toSearchParams(params);
    // Date filters mean calendar days where the viewer is, not in UTC.
    searchParams.set("tz", localTimeZone());
    return apiFetch<Paginated<Customer>>(CUSTOMERS, { searchParams, signal });
  },

  get: (id: string, signal?: AbortSignal) =>
    apiFetch<Customer>(customerPath(id), { signal }),

  create: (input: CustomerInput) =>
    apiFetch<Customer>(CUSTOMERS, { method: "POST", body: input }),

  update: (id: string, input: CustomerUpdate) =>
    apiFetch<Customer>(customerPath(id), { method: "PATCH", body: input }),

  remove: (id: string) =>
    apiFetch<void>(customerPath(id), { method: "DELETE" }),

  bulk: (action: BulkAction) =>
    apiFetch<BulkResult>(`${CUSTOMERS}/bulk`, { method: "POST", body: action }),

  logContact: (id: string, input: ContactLogInput) =>
    apiFetch<Customer>(`${customerPath(id)}/contact`, {
      method: "POST",
      body: input,
    }),

  move: (id: string, input: MoveCustomerInput) =>
    apiFetch<Customer>(`${customerPath(id)}/move`, {
      method: "POST",
      body: input,
    }),

  listCompanies: (signal?: AbortSignal) =>
    apiFetch<string[]>(COMPANIES, { signal }),

  listNotes: (customerId: string, signal?: AbortSignal) =>
    apiFetch<CustomerNote[]>(notesPath(customerId), { signal }),

  addNote: (customerId: string, input: NoteInput) =>
    apiFetch<CustomerNote>(notesPath(customerId), {
      method: "POST",
      body: input,
    }),

  removeNote: (customerId: string, noteId: string) =>
    apiFetch<void>(`${notesPath(customerId)}/${encodeURIComponent(noteId)}`, {
      method: "DELETE",
    }),
};

export const savedFiltersApi = {
  list: (signal?: AbortSignal) =>
    apiFetch<SavedFilter[]>(SAVED_FILTERS, { signal }),

  create: (input: SavedFilterInput) =>
    apiFetch<SavedFilter>(SAVED_FILTERS, { method: "POST", body: input }),

  update: (id: string, input: SavedFilterUpdate) =>
    apiFetch<SavedFilter>(savedFilterPath(id), { method: "PATCH", body: input }),

  remove: (id: string) =>
    apiFetch<void>(savedFilterPath(id), { method: "DELETE" }),
};
