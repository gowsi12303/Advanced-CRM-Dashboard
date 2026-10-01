import { Suspense } from "react";
import type { Metadata } from "next";

import { PipelineView } from "@/features/customers/components/pipeline/pipeline-view";

export const metadata: Metadata = {
  title: "Pipeline",
};

export default function PipelinePage() {
  return (
    // The view reads search and filter state from the URL query string, which
    // is only known on the client, so it renders behind a Suspense boundary.
    <Suspense>
      <PipelineView />
    </Suspense>
  );
}
