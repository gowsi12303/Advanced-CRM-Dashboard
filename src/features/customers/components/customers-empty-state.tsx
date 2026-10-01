import { SearchXIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

type CustomersEmptyStateProps = {
  search: string;
  hasFilters: boolean;
  onClearSearch: () => void;
  onClearFilters: () => void;
};

/** Shown by the table and the pipeline when no customer matches. */
export function CustomersEmptyState({
  search,
  hasFilters,
  onClearSearch,
  onClearFilters,
}: CustomersEmptyStateProps) {
  const hasSearch = search.length > 0;

  return (
    <EmptyState
      icon={SearchXIcon}
      title="No customers found"
      description={
        hasSearch && hasFilters
          ? `Nothing matches “${search}” with the current filters.`
          : hasSearch
            ? `Nothing matches “${search}”. Check the spelling or try a different term.`
            : hasFilters
              ? "No customers match the current filters. Try removing some of them."
              : "There are no customers to show."
      }
      action={
        (hasSearch || hasFilters) && (
          <div className="flex flex-wrap justify-center gap-2">
            {hasSearch && (
              <Button variant="outline" size="sm" onClick={onClearSearch}>
                Clear search
              </Button>
            )}
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={onClearFilters}>
                Clear all filters
              </Button>
            )}
          </div>
        )
      }
    />
  );
}
