import { customerUpdateSchema } from "@/features/customers/lib/schemas";
import { getCustomerRepository } from "@/server/customer-repository";
import { parseBody, withApi } from "@/server/http";

type Context = RouteContext<"/api/customers/[id]">;

export const GET = withApi<Context>(async (_request, context) => {
  const { id } = await context.params;
  return Response.json(await getCustomerRepository().get(id));
});

export const PATCH = withApi<Context>(async (request, context) => {
  const { id } = await context.params;
  const input = await parseBody(request, customerUpdateSchema);
  return Response.json(await getCustomerRepository().update(id, input));
});

export const DELETE = withApi<Context>(async (_request, context) => {
  const { id } = await context.params;
  await getCustomerRepository().remove(id);
  return new Response(null, { status: 204 });
});
