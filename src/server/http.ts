import type { NextRequest } from "next/server";
import type { z } from "zod";

import {
  DEBUG_FAIL_HEADER,
  DEBUG_FAIL_PARAM,
  type ApiErrorBody,
} from "@/lib/api-client";

import { HttpError } from "./errors";

const DEFAULT_DELAY_MS = 400;

/** Artificial latency so loading states are visible. Override with MOCK_API_DELAY_MS. */
function mockDelayMs() {
  const configured = Number(process.env.MOCK_API_DELAY_MS);
  return Number.isFinite(configured) && configured >= 0
    ? configured
    : DEFAULT_DELAY_MS;
}

/**
 * Development-only failure switch. `fail=1` fails every request,
 * `fail=queries` only GETs and `fail=mutations` only writes. It can be passed
 * as a query param on the API URL or via the `x-debug-fail` header, which the
 * API client sets when the page URL carries `?fail=`.
 */
function assertNotForcedToFail(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return;

  const mode =
    request.nextUrl.searchParams.get(DEBUG_FAIL_PARAM) ??
    request.headers.get(DEBUG_FAIL_HEADER);
  if (!mode) return;

  const isQuery = request.method === "GET";
  const shouldFail =
    mode === "1" ||
    mode === "true" ||
    (mode === "queries" && isQuery) ||
    (mode === "mutations" && !isQuery);

  if (shouldFail) {
    throw new HttpError(
      500,
      "simulated_failure",
      "Simulated server error (requested with ?fail)",
    );
  }
}

function errorResponse(error: HttpError) {
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.fieldErrors && { fieldErrors: error.fieldErrors }),
    },
  };
  return Response.json(body, { status: error.status });
}

type RouteHandler<Context> = (
  request: NextRequest,
  context: Context,
) => Promise<Response>;

/** Wraps a route handler with the mock latency, the failure switch and JSON error handling. */
export function withApi<Context>(
  handler: RouteHandler<Context>,
): RouteHandler<Context> {
  return async (request, context) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, mockDelayMs()));
      assertNotForcedToFail(request);
      return await handler(request, context);
    } catch (error) {
      if (error instanceof HttpError) return errorResponse(error);
      console.error(`[api] ${request.method} ${request.nextUrl.pathname}`, error);
      return errorResponse(
        new HttpError(500, "internal_error", "Unexpected server error"),
      );
    }
  };
}

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "root";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export function validationError(error: z.ZodError, message = "Validation failed") {
  return new HttpError(422, "validation_error", message, toFieldErrors(error));
}

/** Reads and validates a JSON request body, throwing a 400/422 `HttpError` on failure. */
export async function parseBody<Schema extends z.ZodType>(
  request: NextRequest,
  schema: Schema,
): Promise<z.output<Schema>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new HttpError(400, "bad_request", "Request body must be valid JSON");
  }

  const result = schema.safeParse(json);
  if (!result.success) throw validationError(result.error);
  return result.data;
}
