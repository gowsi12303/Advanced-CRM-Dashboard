"use client";

import { useState } from "react";
import { BookmarkPlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useCreateSavedFilter } from "../../hooks/use-saved-filters";
import { clearFilterGroup, describeActiveFilters } from "../../lib/filters";
import { EMPTY_CUSTOMER_FILTERS, type CustomerFilters } from "../../types";
import { SavedFilterNameDialog } from "./saved-filter-name-dialog";

type ActiveFiltersBarProps = {
  applied: CustomerFilters;
  onApply: (filters: CustomerFilters) => void;
};

/** Shows what is filtering the table, with one-click removal and saving. */
export function ActiveFiltersBar({ applied, onApply }: ActiveFiltersBarProps) {
  const createSavedFilter = useCreateSavedFilter();
  const [isSaving, setIsSaving] = useState(false);
  const active = describeActiveFilters(applied);

  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul className="contents" aria-label="Active filters">
        {active.map(({ group, label }) => (
          <li key={group} className="max-w-full">
            <Badge variant="secondary" className="max-w-full gap-1 py-1 pr-1 pl-2.5">
              <span className="truncate">{label}</span>
              <button
                type="button"
                onClick={() => onApply(clearFilterGroup(applied, group))}
                className="rounded-full p-0.5 outline-none hover:bg-foreground/10 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <XIcon className="size-3" />
                <span className="sr-only">Remove filter {label}</span>
              </button>
            </Badge>
          </li>
        ))}
      </ul>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onApply(EMPTY_CUSTOMER_FILTERS)}
      >
        Clear filters
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setIsSaving(true)}>
        <BookmarkPlusIcon />
        Save filter
      </Button>

      <SavedFilterNameDialog
        open={isSaving}
        onOpenChange={setIsSaving}
        title="Save filter"
        description="Save the filters currently applied to the table so you can reuse them later."
        submitLabel="Save"
        onSubmit={async (name) => {
          await createSavedFilter.mutateAsync({ name, filters: applied });
          toast.success(`Saved “${name}”`);
        }}
      />
    </div>
  );
}
