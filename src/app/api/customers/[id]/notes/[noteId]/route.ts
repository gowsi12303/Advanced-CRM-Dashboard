import { getCustomerRepository } from "@/server/customer-repository";
import { withApi } from "@/server/http";

type Context = RouteContext<"/api/customers/[id]/notes/[noteId]">;

export const DELETE = withApi<Context>(async (_request, context) => {
  const { id, noteId } = await context.params;
  await getCustomerRepository().removeNote(id, noteId);
  return new Response(null, { status: 204 });
});
