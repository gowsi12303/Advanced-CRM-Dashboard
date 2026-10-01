import type {
  BulkAction,
  ContactLogInput,
  CustomerInput,
  CustomerUpdate,
  MoveCustomerInput,
  NoteInput,
  SavedFilterInput,
  SavedFilterUpdate,
} from "@/features/customers/lib/schemas";
import type {
  BulkResult,
  Customer,
  CustomerListParams,
  CustomerNote,
  CustomerStatus,
  Paginated,
  SavedFilter,
} from "@/features/customers/types";

import { queryCustomers } from "./customer-query";
import { conflict, HttpError, notFound } from "./errors";
import { createSeedData, type SeedData } from "./seed";

/**
 * Everything the API routes need from persistence. The route handlers depend
 * only on this interface, so swapping the in-memory store for a database or an
 * upstream service means writing one new implementation of it.
 */
export interface CustomerRepository {
  /** `timeZone` (IANA name, default UTC) decides which calendar day a date filter means. */
  list(params: CustomerListParams, timeZone?: string): Promise<Paginated<Customer>>;
  get(id: string): Promise<Customer>;
  create(input: CustomerInput): Promise<Customer>;
  update(id: string, input: CustomerUpdate): Promise<Customer>;
  remove(id: string): Promise<void>;
  bulk(action: BulkAction): Promise<BulkResult>;
  logContact(id: string, input: ContactLogInput): Promise<Customer>;
  move(id: string, input: MoveCustomerInput): Promise<Customer>;
  listCompanies(): Promise<string[]>;

  listNotes(customerId: string): Promise<CustomerNote[]>;
  addNote(customerId: string, input: NoteInput): Promise<CustomerNote>;
  removeNote(customerId: string, noteId: string): Promise<void>;

  listSavedFilters(): Promise<SavedFilter[]>;
  createSavedFilter(input: SavedFilterInput): Promise<SavedFilter>;
  updateSavedFilter(id: string, input: SavedFilterUpdate): Promise<SavedFilter>;
  removeSavedFilter(id: string): Promise<void>;
}

const RANK_STEP = 1000;

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function sameText(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Seed data dated relative to today, so rolling-date filters have matches. */
function createDefaultSeed() {
  const anchor = new Date();
  anchor.setUTCHours(0, 0, 0, 0);
  return createSeedData(anchor);
}

export class InMemoryCustomerRepository implements CustomerRepository {
  private customers: Map<string, Customer>;
  private notes: CustomerNote[];
  private savedFilters: SavedFilter[] = [];

  constructor(seed: SeedData = createDefaultSeed()) {
    this.customers = new Map(seed.customers.map((c) => [c.id, c]));
    this.notes = [...seed.notes];
  }

  private require(id: string): Customer {
    const customer = this.customers.get(id);
    if (!customer) throw notFound("Customer");
    return customer;
  }

  private assertEmailAvailable(email: string, exceptId?: string) {
    for (const customer of this.customers.values()) {
      if (customer.id !== exceptId && sameText(customer.email, email)) {
        throw conflict("email", "A customer with this email already exists");
      }
    }
  }

  private assertFilterNameAvailable(name: string, exceptId?: string) {
    const taken = this.savedFilters.some(
      (filter) => filter.id !== exceptId && sameText(filter.name, name),
    );
    if (taken) {
      throw conflict("name", "A saved filter with this name already exists");
    }
  }

  /** Customers of one status in board order. */
  private column(status: CustomerStatus, exceptId?: string): Customer[] {
    return [...this.customers.values()]
      .filter((c) => c.status === status && c.id !== exceptId)
      .sort((a, b) => a.pipelineRank - b.pipelineRank);
  }

  private endOfColumnRank(status: CustomerStatus, exceptId?: string) {
    const last = this.column(status, exceptId).at(-1);
    return (last?.pipelineRank ?? 0) + RANK_STEP;
  }

  private save(customer: Customer): Customer {
    this.customers.set(customer.id, customer);
    return customer;
  }

  async list(params: CustomerListParams, timeZone?: string) {
    return queryCustomers([...this.customers.values()], params, timeZone);
  }

  async get(id: string) {
    return this.require(id);
  }

  async create(input: CustomerInput) {
    this.assertEmailAvailable(input.email);
    const now = new Date().toISOString();
    return this.save({
      id: newId("cus"),
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company,
      jobTitle: input.jobTitle ?? "",
      status: input.status,
      pipelineRank: this.endOfColumnRank(input.status),
      createdAt: now,
      updatedAt: now,
      lastContactedAt: null,
      lastContactMethod: null,
    });
  }

  async update(id: string, input: CustomerUpdate) {
    const current = this.require(id);
    if (input.email !== undefined) this.assertEmailAvailable(input.email, id);

    const statusChanged =
      input.status !== undefined && input.status !== current.status;
    return this.save({
      ...current,
      ...input,
      jobTitle: input.jobTitle ?? current.jobTitle,
      // A customer that changes stage joins the end of its new column.
      pipelineRank: statusChanged
        ? this.endOfColumnRank(input.status ?? current.status, id)
        : current.pipelineRank,
      updatedAt: new Date().toISOString(),
    });
  }

  async remove(id: string) {
    this.require(id);
    this.customers.delete(id);
    this.notes = this.notes.filter((note) => note.customerId !== id);
  }

  async bulk(action: BulkAction) {
    // Validate up front so the operation is all-or-nothing.
    const targets = [...new Set(action.ids)].map((id) => this.require(id));

    if (action.action === "delete") {
      for (const customer of targets) await this.remove(customer.id);
      return { affected: targets.length };
    }

    const changing = targets.filter((c) => c.status !== action.status);
    for (const customer of changing) {
      await this.update(customer.id, { status: action.status });
    }
    return { affected: changing.length };
  }

  async logContact(id: string, input: ContactLogInput) {
    const current = this.require(id);
    const now = new Date().toISOString();
    const contactedAt = input.contactedAt
      ? new Date(input.contactedAt).toISOString()
      : now;

    if (input.note) await this.addNote(id, { body: input.note });

    return this.save({
      ...current,
      lastContactedAt: contactedAt,
      lastContactMethod: input.method,
      updatedAt: now,
    });
  }

  async move(id: string, input: MoveCustomerInput) {
    const current = this.require(id);
    const column = this.column(input.status, id);

    let index = column.length;
    if (input.beforeId !== null) {
      index = column.findIndex((c) => c.id === input.beforeId);
      if (index === -1) {
        throw new HttpError(
          422,
          "validation_error",
          "The target position no longer exists in that column",
        );
      }
    }

    const moved: Customer = {
      ...current,
      status: input.status,
      updatedAt: new Date().toISOString(),
    };
    column.splice(index, 0, moved);
    // Renumber the whole column: trivial at this size and avoids rank drift.
    column.forEach((customer, position) => {
      this.save({ ...customer, pipelineRank: (position + 1) * RANK_STEP });
    });
    return this.require(id);
  }

  async listCompanies() {
    const names = new Set<string>();
    for (const customer of this.customers.values()) names.add(customer.company);
    return [...names].sort((a, b) => a.localeCompare(b));
  }

  async listNotes(customerId: string) {
    this.require(customerId);
    return this.notes
      .filter((note) => note.customerId === customerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addNote(customerId: string, input: NoteInput) {
    this.require(customerId);
    const note: CustomerNote = {
      id: newId("note"),
      customerId,
      body: input.body,
      createdAt: new Date().toISOString(),
    };
    this.notes.push(note);
    return note;
  }

  async removeNote(customerId: string, noteId: string) {
    this.require(customerId);
    const index = this.notes.findIndex(
      (note) => note.id === noteId && note.customerId === customerId,
    );
    if (index === -1) throw notFound("Note");
    this.notes.splice(index, 1);
  }

  async listSavedFilters() {
    return [...this.savedFilters].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }

  async createSavedFilter(input: SavedFilterInput) {
    this.assertFilterNameAvailable(input.name);
    const filter: SavedFilter = {
      id: newId("flt"),
      name: input.name,
      filters: input.filters,
      createdAt: new Date().toISOString(),
    };
    this.savedFilters.push(filter);
    return filter;
  }

  async updateSavedFilter(id: string, input: SavedFilterUpdate) {
    const index = this.savedFilters.findIndex((filter) => filter.id === id);
    if (index === -1) throw notFound("Saved filter");
    if (input.name !== undefined) this.assertFilterNameAvailable(input.name, id);

    const current = this.savedFilters[index];
    const updated: SavedFilter = {
      ...current,
      name: input.name ?? current.name,
      filters: input.filters ?? current.filters,
    };
    this.savedFilters[index] = updated;
    return updated;
  }

  async removeSavedFilter(id: string) {
    const index = this.savedFilters.findIndex((filter) => filter.id === id);
    if (index === -1) throw notFound("Saved filter");
    this.savedFilters.splice(index, 1);
  }
}

// Route handlers can be bundled separately and modules are re-evaluated on hot
// reload in development, so the store lives on `globalThis` to stay a singleton.
const globalStore = globalThis as typeof globalThis & {
  __customerRepository?: CustomerRepository;
};

export function getCustomerRepository(): CustomerRepository {
  globalStore.__customerRepository ??= new InMemoryCustomerRepository();
  return globalStore.__customerRepository;
}

/** Swaps the implementation behind the API routes (a real backend, or a fresh store in tests). */
export function setCustomerRepository(repository: CustomerRepository) {
  globalStore.__customerRepository = repository;
}
