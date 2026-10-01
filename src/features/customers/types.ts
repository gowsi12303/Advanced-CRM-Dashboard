/** Lifecycle stages, in pipeline order. */
export const CUSTOMER_STATUSES = [
  "lead",
  "prospect",
  "active",
  "inactive",
  "churned",
] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  lead: "Lead",
  prospect: "Prospect",
  active: "Active",
  inactive: "Inactive",
  churned: "Churned",
};

export const CONTACT_METHODS = ["email", "phone", "meeting", "other"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  email: "Email",
  phone: "Phone call",
  meeting: "Meeting",
  other: "Other",
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  status: CustomerStatus;
  /** Ordering of the customer inside its status column on the pipeline board. */
  pipelineRank: number;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp. */
  updatedAt: string;
  /** ISO timestamp, or null when the customer has never been contacted. */
  lastContactedAt: string | null;
  lastContactMethod: ContactMethod | null;
};

export type CustomerNote = {
  id: string;
  customerId: string;
  body: string;
  /** ISO timestamp. */
  createdAt: string;
};

export const DATE_FILTER_FIELDS = ["createdAt", "lastContactedAt"] as const;
export type DateFilterField = (typeof DATE_FILTER_FIELDS)[number];

export type CustomerFilters = {
  status: CustomerStatus[];
  companies: string[];
  /** Which date the range below applies to. */
  dateField: DateFilterField;
  /** Inclusive calendar date, `yyyy-MM-dd`. */
  dateFrom: string | null;
  /** Inclusive calendar date, `yyyy-MM-dd`. */
  dateTo: string | null;
  /**
   * With a last-contact date range, also match customers who have never been
   * contacted (they have no date to compare). Ignored otherwise.
   */
  includeNeverContacted: boolean;
  /** Partial, case-insensitive match. */
  email: string;
  /** Partial match; formatting characters are ignored. */
  phone: string;
};

export const EMPTY_CUSTOMER_FILTERS: CustomerFilters = {
  status: [],
  companies: [],
  dateField: "createdAt",
  dateFrom: null,
  dateTo: null,
  includeNeverContacted: false,
  email: "",
  phone: "",
};

export const CUSTOMER_SORT_FIELDS = [
  "name",
  "company",
  "email",
  "status",
  "createdAt",
  "lastContactedAt",
  "pipelineRank",
] as const;
export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];

export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;
/** Upper bound accepted by the API; used by the pipeline board and CSV export. */
export const MAX_PAGE_SIZE = 500;

export type CustomerListParams = {
  search: string;
  filters: CustomerFilters;
  sortBy: CustomerSortField;
  sortOrder: SortOrder;
  page: number;
  pageSize: number;
};

export const DEFAULT_CUSTOMER_LIST_PARAMS: CustomerListParams = {
  search: "",
  filters: EMPTY_CUSTOMER_FILTERS,
  sortBy: "createdAt",
  sortOrder: "desc",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type SavedFilter = {
  id: string;
  name: string;
  filters: CustomerFilters;
  /** ISO timestamp. */
  createdAt: string;
};

export type BulkResult = {
  affected: number;
};
