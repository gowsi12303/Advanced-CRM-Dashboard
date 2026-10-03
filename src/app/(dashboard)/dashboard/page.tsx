import type { Metadata } from "next";

import { DashboardView } from "@/features/customers/components/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return <DashboardView />;
}
