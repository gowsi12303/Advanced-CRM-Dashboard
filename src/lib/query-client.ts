import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-client";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays fresh briefly so navigating between views doesn't refetch,
        // while mutations still invalidate explicitly.
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        // Retry transient failures once; a 4xx will fail the same way again.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.isClientError) &&
          failureCount < 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  // On the server every request gets its own client so no data leaks between users.
  if (typeof window === "undefined") return makeQueryClient();
  // In the browser reuse one client so the cache survives re-renders and suspense.
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
