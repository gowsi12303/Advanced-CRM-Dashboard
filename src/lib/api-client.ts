export type ApiErrorCode =
  | "bad_request"
  | "validation_error"
  | "not_found"
  | "conflict"
  | "internal_error"
  | "simulated_failure"
  | "network_error";

/** JSON body returned by every failing API route. */
export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Per-field messages, keyed by dotted field path. */
    fieldErrors?: Record<string, string[]>;
  };
};

/**
 * Development aid: open any page with `?fail=1` to make every API call fail,
 * `?fail=queries` to fail only reads, or `?fail=mutations` to fail only writes.
 * The server ignores the header in production builds.
 */
export const DEBUG_FAIL_PARAM = "fail";
export const DEBUG_FAIL_HEADER = "x-debug-fail";

export class ApiError extends Error {
  constructor(
    /** HTTP status, or 0 when the request never reached the server. */
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True for errors the user caused and can fix; these are never worth retrying. */
  get isClientError() {
    return this.status >= 400 && this.status < 500;
  }
}

/** A user-presentable message for any thrown value. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  searchParams?: URLSearchParams;
  body?: unknown;
  signal?: AbortSignal;
};

function debugFailMode(): string | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get(DEBUG_FAIL_PARAM);
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const { error } = value;
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  );
}

export async function apiFetch<T>(
  path: string,
  { method = "GET", searchParams, body, signal }: ApiRequestOptions = {},
): Promise<T> {
  const query = searchParams?.toString();
  const url = query ? `${path}?${query}` : path;

  const headers = new Headers({ Accept: "application/json" });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const failMode = debugFailMode();
  if (failMode) headers.set(DEBUG_FAIL_HEADER, failMode);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // Let TanStack Query see cancellations as cancellations.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "network_error",
      "Could not reach the server. Check your connection and try again.",
    );
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      const { code, message, fieldErrors } = payload.error;
      throw new ApiError(response.status, code, message, fieldErrors);
    }
    throw new ApiError(
      response.status,
      "internal_error",
      `Request failed with status ${response.status}`,
    );
  }

  return payload as T;
}
