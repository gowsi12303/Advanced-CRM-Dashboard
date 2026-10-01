import { NextRequest } from "next/server";
import { vi } from "vitest";

import * as companiesRoute from "@/app/api/companies/route";
import * as contactRoute from "@/app/api/customers/[id]/contact/route";
import * as moveRoute from "@/app/api/customers/[id]/move/route";
import * as noteRoute from "@/app/api/customers/[id]/notes/[noteId]/route";
import * as notesRoute from "@/app/api/customers/[id]/notes/route";
import * as customerRoute from "@/app/api/customers/[id]/route";
import * as bulkRoute from "@/app/api/customers/bulk/route";
import * as customersRoute from "@/app/api/customers/route";
import * as savedFilterRoute from "@/app/api/saved-filters/[id]/route";
import * as savedFiltersRoute from "@/app/api/saved-filters/route";
import type { Customer, CustomerListParams } from "@/features/customers/types";
import type { ApiErrorBody } from "@/lib/api-client";
import { localTimeZone } from "@/lib/format";
import {
  InMemoryCustomerRepository,
  setCustomerRepository,
} from "@/server/customer-repository";
import { createSeedData } from "@/server/seed";

type Handler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;
type RouteModule = Partial<Record<string, unknown>>;

// The app's real route handlers, matched the way Next.js would. More specific
// patterns come first.
const PARAM_NAMES = ["id", "noteId"];
const ROUTES: [RegExp, RouteModule][] = [
  [/^\/api\/customers$/, customersRoute],
  [/^\/api\/customers\/bulk$/, bulkRoute],
  [/^\/api\/customers\/([^/]+)\/contact$/, contactRoute],
  [/^\/api\/customers\/([^/]+)\/move$/, moveRoute],
  [/^\/api\/customers\/([^/]+)\/notes$/, notesRoute],
  [/^\/api\/customers\/([^/]+)\/notes\/([^/]+)$/, noteRoute],
  [/^\/api\/customers\/([^/]+)$/, customerRoute],
  [/^\/api\/companies$/, companiesRoute],
  [/^\/api\/saved-filters$/, savedFiltersRoute],
  [/^\/api\/saved-filters\/([^/]+)$/, savedFilterRoute],
];

type Endpoint = "customers" | "companies" | "saved-filters";
type RequestMatcher = (method: string, path: string) => boolean;

function serverError() {
  const body: ApiErrorBody = {
    error: { code: "internal_error", message: "Database unavailable" },
  };
  return Response.json(body, { status: 500 });
}

/** The seed is anchored to today so rolling-date filter templates match real rows. */
function startOfTodayUtc() {
  const anchor = new Date();
  anchor.setUTCHours(0, 0, 0, 0);
  return anchor;
}

const EVERYONE: CustomerListParams = {
  search: "",
  filters: {
    status: [],
    companies: [],
    dateField: "createdAt",
    dateFrom: null,
    dateTo: null,
    includeNeverContacted: false,
    email: "",
    phone: "",
  },
  sortBy: "createdAt",
  sortOrder: "desc",
  page: 1,
  pageSize: 500,
};

/**
 * Replaces `fetch` with the app's own API: requests are dispatched to the real
 * route handlers, backed by a fresh in-memory repository per test. Component
 * tests therefore exercise real validation, filtering and persistence, with
 * hooks for forcing failures and holding responses.
 */
export function installMockApi() {
  const seed = createSeedData(startOfTodayUtc());
  const repository = new InMemoryCustomerRepository(seed);
  setCustomerRepository(repository);

  /** Every request as "METHOD /path", in order. */
  const requests: string[] = [];
  /** Every write request with its parsed JSON body, in order. */
  const mutations: { method: string; path: string; body: unknown }[] = [];
  /** Query strings of every customer list request, in order. */
  const listRequests: URLSearchParams[] = [];
  const failing = new Set<RequestMatcher>();
  const failingEndpoints = new Map<Endpoint, RequestMatcher>();
  let release: (() => void) | null = null;
  let gate: Promise<void> | null = null;
  let gated: RequestMatcher = () => true;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    requests.push(`${method} ${url.pathname}`);
    if (method === "GET" && url.pathname === "/api/customers") {
      listRequests.push(url.searchParams);
    }
    if (method !== "GET") {
      mutations.push({
        method,
        path: url.pathname,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
    }

    if (gate && gated(method, url.pathname)) await gate;
    for (const matches of failing) {
      if (matches(method, url.pathname)) return serverError();
    }

    for (const [pattern, routeModule] of ROUTES) {
      const match = pattern.exec(url.pathname);
      const handler = routeModule[method];
      if (!match || typeof handler !== "function") continue;
      const request = new NextRequest(url, {
        method,
        headers: init?.headers,
        body: init?.body,
      });
      return (handler as Handler)(request, {
        // Captures are positional: the first is always `id`, the second `noteId`.
        params: Promise.resolve(
          Object.fromEntries(match.slice(1).map((value, i) => [PARAM_NAMES[i], value])),
        ),
      });
    }
    return new Response(null, { status: 404 });
  });

  vi.stubGlobal("fetch", fetchMock);

  return {
    /** The customers the store started with. */
    customers: seed.customers as readonly Customer[],
    repository,
    requests,
    mutations,
    listRequests,
    /** What the API returns for the given params, read straight from the store. */
    // Uses the machine's time zone, as the UI's requests do.
    expected: (params: CustomerListParams) =>
      repository.list(params, localTimeZone()),
    /** Every customer currently in the store. */
    allCustomers: async () => (await repository.list(EVERYONE)).items,
    savedFilters: () => repository.listSavedFilters(),
    /** Makes every request to an endpoint (the customer API by default) answer with a 500. */
    setFailing: (value: boolean, endpoint: Endpoint = "customers") => {
      const existing = failingEndpoints.get(endpoint);
      if (existing) failing.delete(existing);
      failingEndpoints.delete(endpoint);
      if (value) {
        const matcher: RequestMatcher = (_method, path) =>
          path.split("/")[2] === endpoint;
        failingEndpoints.set(endpoint, matcher);
        failing.add(matcher);
      }
    },
    /** Fails matching requests with a 500 until the returned function is called. */
    failWhen: (matcher: RequestMatcher) => {
      failing.add(matcher);
      return () => {
        failing.delete(matcher);
      };
    },
    /** Holds every (or every matching) response until `resume` is called. */
    pause: (matcher: RequestMatcher = () => true) => {
      gated = matcher;
      gate = new Promise((resolve) => {
        release = resolve;
      });
    },
    resume: () => {
      release?.();
      gate = null;
      release = null;
    },
  };
}
