"use client";

import { useState } from "react";
import { Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api-client";

import {
  useDeleteSavedFilter,
  useSavedFilters,
  useUpdateSavedFilter,
} from "../../hooks/use-saved-filters";
import { describeActiveFilters } from "../../lib/filters";
import type { CustomerFilters, SavedFilter } from "../../types";
import { SavedFilterNameDialog } from "./saved-filter-name-dialog";

type SavedFiltersSectionProps = {
  /** Applies the chosen filter set to the table. */
  onApply: (filters: CustomerFilters) => void;
};

function summarize(filters: CustomerFilters) {
  const parts = describeActiveFilters(filters).map((item) => item.label);
  return parts.length > 0 ? parts.join(" · ") : "No filters";
}

export function SavedFiltersSection({ onApply }: SavedFiltersSectionProps) {
  const savedFilters = useSavedFilters();
  const updateSavedFilter = useUpdateSavedFilter();
  const deleteSavedFilter = useDeleteSavedFilter();
  const [renaming, setRenaming] = useState<SavedFilter | null>(null);

  const handleDelete = (filter: SavedFilter) => {
    deleteSavedFilter.mutate(filter.id, {
      onSuccess: () => toast.success(`Deleted “${filter.name}”`),
      onError: (error) =>
        toast.error(`Couldn't delete “${filter.name}”`, {
          description: getErrorMessage(error),
        }),
    });
  };

  if (savedFilters.isPending) {
    return (
      <div className="space-y-2" aria-busy aria-label="Loading saved filters">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  if (savedFilters.isError) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 p-3 text-sm"
      >
        <span>
          Couldn&apos;t load saved filters. {getErrorMessage(savedFilters.error)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => savedFilters.refetch()}
          disabled={savedFilters.isFetching}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (savedFilters.data.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        No saved filters yet. Apply some filters, then choose “Save filter”
        above the table.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-1" aria-label="Saved filters">
        {savedFilters.data.map((filter) => {
          const isDeleting =
            deleteSavedFilter.isPending && deleteSavedFilter.variables === filter.id;
          return (
            <li
              key={filter.id}
              className="flex items-center gap-1 rounded-lg border bg-card pr-1"
            >
              <button
                type="button"
                onClick={() => onApply(filter.filters)}
                disabled={isDeleting}
                className="min-w-0 flex-1 rounded-md px-3 py-2 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <span className="block truncate text-sm font-medium">
                  {filter.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {summarize(filter.filters)}
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setRenaming(filter)}
                disabled={isDeleting}
              >
                <PencilIcon />
                <span className="sr-only">Rename {filter.name}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDelete(filter)}
                disabled={isDeleting}
                className="text-destructive hover:text-destructive"
              >
                {isDeleting ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
                <span className="sr-only">Delete {filter.name}</span>
              </Button>
            </li>
          );
        })}
      </ul>

      <SavedFilterNameDialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
        title="Rename saved filter"
        description="Give this saved filter a new name."
        initialName={renaming?.name}
        submitLabel="Rename"
        onSubmit={async (name) => {
          if (!renaming) return;
          await updateSavedFilter.mutateAsync({ id: renaming.id, input: { name } });
          toast.success(`Renamed to “${name}”`);
        }}
      />
    </>
  );
}
