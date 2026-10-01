import { savedFilterInputSchema } from "@/features/customers/lib/schemas";
import { getCustomerRepository } from "@/server/customer-repository";
import { parseBody, withApi } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  return Response.json(await getCustomerRepository().listSavedFilters());
});

export const POST = withApi(async (request) => {
  const input = await parseBody(request, savedFilterInputSchema);
  const filter = await getCustomerRepository().createSavedFilter(input);
  return Response.json(filter, { status: 201 });
});
