import type { ApiErrorCode } from "@/lib/api-client";

/** An error with a known HTTP status, rendered as a JSON error body by `withApi`. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function notFound(entity: string) {
  return new HttpError(404, "not_found", `${entity} not found`);
}

/** A uniqueness conflict, attributed to the field that caused it. */
export function conflict(field: string, message: string) {
  return new HttpError(409, "conflict", message, { [field]: [message] });
}
