"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type MultiSelectListProps = {
  /** Names the group for assistive tech, e.g. "Companies". */
  label: string;
  options: readonly string[];
  value: readonly string[];
  onChange: (value: string[]) => void;
  searchPlaceholder?: string;
};

/**
 * A searchable checklist for picking several values. An always-visible list
 * (rather than a popover) keeps it usable with touch and inside a drawer.
 */
export function MultiSelectList({
  label,
  options,
  value,
  onChange,
  searchPlaceholder = "Search…",
}: MultiSelectListProps) {
  const id = useId();
  const [query, setQuery] = useState("");

  // Keep selected values that are no longer offered, so they can be unticked.
  const allOptions = [
    ...options,
    ...value.filter((selected) => !options.includes(selected)),
  ];
  const term = query.trim().toLowerCase();
  const visible = term
    ? allOptions.filter((option) => option.toLowerCase().includes(term))
    : allOptions;

  const toggle = (option: string, checked: boolean) => {
    onChange(
      checked
        ? [...value, option]
        : value.filter((selected) => selected !== option),
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={`Search ${label.toLowerCase()}`}
          className="h-8"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([])}
          disabled={value.length === 0}
          aria-label={`Clear selected ${label.toLowerCase()}`}
        >
          Clear
        </Button>
      </div>

      <div
        role="group"
        aria-label={label}
        className="max-h-44 overflow-y-auto rounded-md border p-1"
      >
        {visible.length === 0 ? (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">
            No matches
          </p>
        ) : (
          visible.map((option, index) => {
            const optionId = `${id}-${index}`;
            return (
              <div
                key={option}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent"
              >
                <Checkbox
                  id={optionId}
                  checked={value.includes(option)}
                  onCheckedChange={(checked) => toggle(option, checked === true)}
                />
                <label
                  htmlFor={optionId}
                  className="flex-1 cursor-pointer truncate text-sm"
                >
                  {option}
                </label>
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {value.length === 0 ? "None selected" : `${value.length} selected`}
      </p>
    </div>
  );
}
