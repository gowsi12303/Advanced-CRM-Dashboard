import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/format";

type DataTablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  pageSizeOptions: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** Plural noun for the rows, e.g. "customers". */
  itemLabel: string;
  disabled?: boolean;
};

export function DataTablePagination({
  page,
  pageSize,
  total,
  totalPages,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  itemLabel,
  disabled = false,
}: DataTablePaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing{" "}
        <span className="font-medium text-foreground tabular-nums">
          {formatNumber(first)}–{formatNumber(last)}
        </span>{" "}
        of{" "}
        <span className="font-medium text-foreground tabular-nums">
          {formatNumber(total)}
        </span>{" "}
        {itemLabel}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span id="rows-per-page-label" className="text-sm text-muted-foreground">
            Rows per page
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
            disabled={disabled}
          >
            <SelectTrigger
              size="sm"
              className="w-[4.5rem]"
              aria-labelledby="rows-per-page-label"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm whitespace-nowrap tabular-nums">
            Page {formatNumber(page)} of {formatNumber(totalPages)}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              className="hidden sm:inline-flex"
              onClick={() => onPageChange(1)}
              disabled={disabled || isFirstPage}
            >
              <ChevronsLeftIcon />
              <span className="sr-only">First page</span>
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange(page - 1)}
              disabled={disabled || isFirstPage}
            >
              <ChevronLeftIcon />
              <span className="sr-only">Previous page</span>
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange(page + 1)}
              disabled={disabled || isLastPage}
            >
              <ChevronRightIcon />
              <span className="sr-only">Next page</span>
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="hidden sm:inline-flex"
              onClick={() => onPageChange(totalPages)}
              disabled={disabled || isLastPage}
            >
              <ChevronsRightIcon />
              <span className="sr-only">Last page</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
