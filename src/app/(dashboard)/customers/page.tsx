import { Suspense } from "react";
import type { Metadata } from "next";

import { CustomersView } from "@/features/customers/components/customers-view";

export const metadata: Metadata = {
  title: "Customers",
};

export default function CustomersPage() {
  return (
    // The view reads list state from the URL query string, which is only
    // known on the client, so it renders behind a Suspense boundary.
    <Suspense>
      <CustomersView />
    </Suspense>
  );
}
