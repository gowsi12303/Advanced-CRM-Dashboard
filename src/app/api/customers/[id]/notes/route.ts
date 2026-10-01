import { noteInputSchema } from "@/features/customers/lib/schemas";
import { getCustomerRepository } from "@/server/customer-repository";
import { parseBody, withApi } from "@/server/http";

type Context = RouteContext<"/api/customers/[id]/notes">;

export const GET = withApi<Context>(async (_request, context) => {
  const { id } = await context.params;
  return Response.json(await getCustomerRepository().listNotes(id));
});

export const POST = withApi<Context>(async (request, context) => {
  const { id } = await context.params;
  const input = await parseBody(request, noteInputSchema);
  const note = await getCustomerRepository().addNote(id, input);
  return Response.json(note, { status: 201 });
});
