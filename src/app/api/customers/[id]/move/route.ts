import { moveCustomerSchema } from "@/features/customers/lib/schemas";
import { getCustomerRepository } from "@/server/customer-repository";
import { parseBody, withApi } from "@/server/http";

type Context = RouteContext<"/api/customers/[id]/move">;

/** Moves a customer to a status column and position on the pipeline board. */
export const POST = withApi<Context>(async (request, context) => {
  const { id } = await context.params;
  const input = await parseBody(request, moveCustomerSchema);
  return Response.json(await getCustomerRepository().move(id, input));
});
