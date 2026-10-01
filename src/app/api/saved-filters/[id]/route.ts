import { savedFilterUpdateSchema } from "@/features/customers/lib/schemas";
import { getCustomerRepository } from "@/server/customer-repository";
import { parseBody, withApi } from "@/server/http";

type Context = RouteContext<"/api/saved-filters/[id]">;

export const PATCH = withApi<Context>(async (request, context) => {
  const { id } = await context.params;
  const input = await parseBody(request, savedFilterUpdateSchema);
  return Response.json(
    await getCustomerRepository().updateSavedFilter(id, input),
  );
});

export const DELETE = withApi<Context>(async (_request, context) => {
  const { id } = await context.params;
  await getCustomerRepository().removeSavedFilter(id);
  return new Response(null, { status: 204 });
});
