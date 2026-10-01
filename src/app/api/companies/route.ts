import { getCustomerRepository } from "@/server/customer-repository";
import { withApi } from "@/server/http";

export const dynamic = "force-dynamic";

/** Distinct company names, used as options for the company filter. */
export const GET = withApi(async () => {
  return Response.json(await getCustomerRepository().listCompanies());
});
