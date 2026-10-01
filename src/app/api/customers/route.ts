import { parseSearchParams } from "@/features/customers/lib/list-params";
import { customerInputSchema } from "@/features/customers/lib/schemas";
import { isValidTimeZone } from "@/server/customer-query";
import { getCustomerRepository } from "@/server/customer-repository";
import { HttpError } from "@/server/errors";
import { parseBody, validationError, withApi } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request) => {
  const params = parseSearchParams(request.nextUrl.searchParams);
  if (!params.success) {
    throw validationError(params.error, "Invalid query parameters");
  }
  // Date filters are calendar days in the caller's time zone.
  const timeZone = request.nextUrl.searchParams.get("tz") ?? "UTC";
  if (!isValidTimeZone(timeZone)) {
    throw new HttpError(422, "validation_error", "Invalid query parameters", {
      tz: ["Unknown time zone"],
    });
  }
  return Response.json(await getCustomerRepository().list(params.data, timeZone));
});

export const POST = withApi(async (request) => {
  const input = await parseBody(request, customerInputSchema);
  const customer = await getCustomerRepository().create(input);
  return Response.json(customer, { status: 201 });
});
