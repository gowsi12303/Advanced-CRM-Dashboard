import { bulkActionSchema } from "@/features/customers/lib/schemas";
import { getCustomerRepository } from "@/server/customer-repository";
import { parseBody, withApi } from "@/server/http";

export const POST = withApi(async (request) => {
  const action = await parseBody(request, bulkActionSchema);
  return Response.json(await getCustomerRepository().bulk(action));
});
