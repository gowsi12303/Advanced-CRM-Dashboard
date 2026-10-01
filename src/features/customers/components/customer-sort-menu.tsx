"use client";

import { ArrowUpDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { CustomerSortField, SortOrder } from "../types";
import { TABLE_SORT_FIELDS } from "./customer-sort";

type CustomerSortMenuProps = {
  sortBy: CustomerSortField;
  sortOrder: SortOrder;
  onSortChange: (sortBy: CustomerSortField, sortOrder: SortOrder) => void;
  className?: string;
};

/**
 * Sort control for narrow screens, where some sortable columns (and so their
 * header buttons) are hidden.
 */
export function CustomerSortMenu({
  sortBy,
  sortOrder,
  onSortChange,
  className,
}: CustomerSortMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className}>
          <ArrowUpDownIcon />
          Sort
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortBy}
          onValueChange={(value) => {
            const match = TABLE_SORT_FIELDS.find((item) => item.field === value);
            if (match) onSortChange(match.field, sortOrder);
          }}
        >
          {TABLE_SORT_FIELDS.map(({ field, label }) => (
            <DropdownMenuRadioItem key={field} value={field}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Order</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) =>
            onSortChange(sortBy, value === "asc" ? "asc" : "desc")
          }
        >
          <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="desc">Descending</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
