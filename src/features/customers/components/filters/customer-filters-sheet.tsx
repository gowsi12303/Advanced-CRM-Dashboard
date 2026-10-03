"use client";

import { useState } from "react";
import { ListFilterIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { FILTER_TEMPLATES } from "../../lib/filter-templates";
import { areFiltersEqual, isDateRangeValid } from "../../lib/filters";
import { countActiveFilters } from "../../lib/list-params";
import { EMPTY_CUSTOMER_FILTERS, type CustomerFilters } from "../../types";
import { CustomerFilterForm } from "./customer-filter-form";
import { SavedFiltersSection } from "./saved-filters-section";

type CustomerFiltersSheetProps = {
  /** The filters currently applied to the table. */
  applied: CustomerFilters;
  /** Commits a filter set: the table refetches and returns to page 1. */
  onApply: (filters: CustomerFilters) => void;
};

function FiltersPanel({
  applied,
  onApply,
  onClose,
}: CustomerFiltersSheetProps & { onClose: () => void }) {
  // Edits stay in this draft until "Apply filters"; the table is not refetched
  // on every keystroke or checkbox.
  const [draft, setDraft] = useState(applied);

  const isDirty = !areFiltersEqual(draft, applied);
  const isValid = isDateRangeValid(draft);
  const draftCount = countActiveFilters(draft);
  const canClear = draftCount > 0 || countActiveFilters(applied) > 0;

  const applyAndClose = (filters: CustomerFilters) => {
    onApply(filters);
    onClose();
  };

  const clearAll = () => {
    setDraft(EMPTY_CUSTOMER_FILTERS);
    onApply(EMPTY_CUSTOMER_FILTERS);
  };

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (isDirty && isValid) applyAndClose(draft);
      }}
    >
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        <section className="space-y-2.5" aria-labelledby="filter-templates-heading">
          <h3 id="filter-templates-heading" className="text-sm font-medium">
            Templates
          </h3>
          <ul className="space-y-1">
            {FILTER_TEMPLATES.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  onClick={() => applyAndClose(template.build(new Date()))}
                  className="w-full rounded-lg border bg-card px-3 py-2 text-left outline-none transition-colors hover:border-ring/60 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="block text-sm font-medium">{template.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {template.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2.5" aria-labelledby="saved-filters-heading">
          <h3 id="saved-filters-heading" className="text-sm font-medium">
            Saved filters
          </h3>
          <SavedFiltersSection onApply={applyAndClose} />
        </section>

        <Separator />

        <CustomerFilterForm draft={draft} onChange={setDraft} />
      </div>

      <SheetFooter className="border-t bg-card/50">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {!isValid
            ? "Fix the date range to apply."
            : isDirty
              ? "You have changes that are not applied yet."
              : draftCount === 0
                ? "No filters applied."
                : `${draftCount} ${draftCount === 1 ? "filter" : "filters"} applied.`}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={clearAll}
            disabled={!canClear}
          >
            Clear all
          </Button>
          <Button type="submit" className="flex-1" disabled={!isDirty || !isValid}>
            Apply filters
          </Button>
        </div>
      </SheetFooter>
    </form>
  );
}

export function CustomerFiltersSheet({
  applied,
  onApply,
}: CustomerFiltersSheetProps) {
  const [open, setOpen] = useState(false);
  const activeCount = countActiveFilters(applied);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          aria-label={
            activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"
          }
        >
          <ListFilterIcon />
          Filters
          {activeCount > 0 && (
            <Badge className="h-5 min-w-5 px-1.5 tabular-nums">{activeCount}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Narrow the customer list. Changes take effect when you apply them.
          </SheetDescription>
        </SheetHeader>
        {/* Mounted only while open, so the draft restarts from what is applied. */}
        <FiltersPanel
          applied={applied}
          onApply={onApply}
          onClose={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
