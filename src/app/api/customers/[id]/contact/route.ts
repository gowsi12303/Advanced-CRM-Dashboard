import { contactLogSchema } from "@/features/customers/lib/schemas";
import { getCustomerRepository } from "@/server/customer-repository";
import { parseBody, withApi } from "@/server/http";

type Context = RouteContext<"/api/customers/[id]/contact">;

/** Records a contact with the customer, updating their last-contact details. */
export const POST = withApi<Context>(async (request, context) => {
  const { id } = await context.params;
  const input = await parseBody(request, contactLogSchema);
  return Response.json(await getCustomerRepository().logContact(id, input));
});
