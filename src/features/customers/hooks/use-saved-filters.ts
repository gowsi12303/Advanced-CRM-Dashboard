import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { savedFiltersApi } from "../api/customers-api";
import type { SavedFilterInput, SavedFilterUpdate } from "../lib/schemas";
import { savedFilterKeys } from "./query-keys";

export function useSavedFilters() {
  return useQuery({
    queryKey: savedFilterKeys.all,
    queryFn: ({ signal }) => savedFiltersApi.list(signal),
  });
}

export function useCreateSavedFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SavedFilterInput) => savedFiltersApi.create(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: savedFilterKeys.all }),
  });
}

export function useUpdateSavedFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SavedFilterUpdate }) =>
      savedFiltersApi.update(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: savedFilterKeys.all }),
  });
}

export function useDeleteSavedFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => savedFiltersApi.remove(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: savedFilterKeys.all }),
  });
}
