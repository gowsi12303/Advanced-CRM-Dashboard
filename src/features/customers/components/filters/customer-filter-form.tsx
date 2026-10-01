"use client";

import { useId } from "react";

import { MultiSelectList } from "@/components/shared/multi-select-list";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api-client";

import { useCompanies } from "../../hooks/use-customers";
import { DATE_FILTER_FIELD_LABELS, isDateRangeValid } from "../../lib/filters";
import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  DATE_FILTER_FIELDS,
  type CustomerFilters,
  type CustomerStatus,
} from "../../types";

type CustomerFilterFormProps = {
  /** The filters being edited; nothing here reaches the table until applied. */
  draft: CustomerFilters;
  onChange: (draft: CustomerFilters) => void;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-2.5 text-sm font-medium">{title}</legend>
      {children}
    </fieldset>
  );
}

function CompanyOptions({ draft, onChange }: CustomerFilterFormProps) {
  const companies = useCompanies();

  if (companies.isPending) {
    return (
      <div className="space-y-2" aria-busy aria-label="Loading companies">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (companies.isError) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 p-3 text-sm"
      >
        <span>Couldn&apos;t load companies. {getErrorMessage(companies.error)}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => companies.refetch()}
          disabled={companies.isFetching}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <MultiSelectList
      label="Companies"
      options={companies.data}
      value={draft.companies}
      onChange={(selected) => onChange({ ...draft, companies: selected })}
      searchPlaceholder="Search companies"
    />
  );
}

export function CustomerFilterForm({ draft, onChange }: CustomerFilterFormProps) {
  const id = useId();
  const isRangeValid = isDateRangeValid(draft);
  const hasDate = Boolean(draft.dateFrom || draft.dateTo);

  const toggleStatus = (status: CustomerStatus, checked: boolean) => {
    onChange({
      ...draft,
      status: checked
        ? [...draft.status, status]
        : draft.status.filter((selected) => selected !== status),
    });
  };

  return (
    <div className="space-y-6">
      <Section title="Status">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {CUSTOMER_STATUSES.map((status) => (
            <div key={status} className="flex items-center gap-2">
              <Checkbox
                id={`${id}-status-${status}`}
                checked={draft.status.includes(status)}
                onCheckedChange={(checked) =>
                  toggleStatus(status, checked === true)
                }
              />
              <Label htmlFor={`${id}-status-${status}`} className="font-normal">
                {CUSTOMER_STATUS_LABELS[status]}
              </Label>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Company">
        <CompanyOptions draft={draft} onChange={onChange} />
      </Section>

      <Section title="Date range">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-date-field`} className="text-xs font-normal text-muted-foreground">
            Applies to
          </Label>
          <Select
            value={draft.dateField}
            onValueChange={(value) => {
              const field = DATE_FILTER_FIELDS.find((item) => item === value);
              if (field) onChange({ ...draft, dateField: field });
            }}
          >
            <SelectTrigger id={`${id}-date-field`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {DATE_FILTER_FIELDS.map((field) => (
                <SelectItem key={field} value={field}>
                  {DATE_FILTER_FIELD_LABELS[field]} date
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-date-from`} className="text-xs font-normal text-muted-foreground">
              From
            </Label>
            <Input
              id={`${id}-date-from`}
              type="date"
              value={draft.dateFrom ?? ""}
              max={draft.dateTo ?? undefined}
              onChange={(event) =>
                onChange({ ...draft, dateFrom: event.target.value || null })
              }
              aria-invalid={!isRangeValid}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-date-to`} className="text-xs font-normal text-muted-foreground">
              To
            </Label>
            <Input
              id={`${id}-date-to`}
              type="date"
              value={draft.dateTo ?? ""}
              min={draft.dateFrom ?? undefined}
              onChange={(event) =>
                onChange({ ...draft, dateTo: event.target.value || null })
              }
              aria-invalid={!isRangeValid}
              aria-describedby={isRangeValid ? undefined : `${id}-date-error`}
            />
          </div>
        </div>
        {draft.dateField === "lastContactedAt" && (
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${id}-include-never`}
              checked={draft.includeNeverContacted}
              disabled={!hasDate}
              onCheckedChange={(checked) =>
                onChange({ ...draft, includeNeverContacted: checked === true })
              }
            />
            <Label htmlFor={`${id}-include-never`} className="font-normal">
              Also include customers never contacted
            </Label>
          </div>
        )}
        {!isRangeValid ? (
          <p id={`${id}-date-error`} role="alert" className="text-xs text-destructive">
            The end date must be on or after the start date.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Either end can be left open.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() =>
                onChange({
                  ...draft,
                  dateFrom: null,
                  dateTo: null,
                  includeNeverContacted: false,
                })
              }
              disabled={!hasDate}
            >
              Clear dates
            </Button>
          </div>
        )}
      </Section>

      <Section title="Contact details">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-email`} className="text-xs font-normal text-muted-foreground">
            Email contains
          </Label>
          <Input
            id={`${id}-email`}
            type="text"
            inputMode="email"
            autoComplete="off"
            value={draft.email}
            onChange={(event) => onChange({ ...draft, email: event.target.value })}
            placeholder="e.g. @vela or priya"
            maxLength={120}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-phone`} className="text-xs font-normal text-muted-foreground">
            Phone contains
          </Label>
          <Input
            id={`${id}-phone`}
            type="text"
            inputMode="tel"
            autoComplete="off"
            value={draft.phone}
            onChange={(event) => onChange({ ...draft, phone: event.target.value })}
            placeholder="e.g. 415 or 555-01"
            maxLength={30}
          />
        </div>
      </Section>
    </div>
  );
}
