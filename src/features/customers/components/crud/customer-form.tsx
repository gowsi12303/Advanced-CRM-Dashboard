"use client";

import { useId } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { applySubmitError, submitOnce } from "@/lib/form-errors";

import { useCompanies } from "../../hooks/use-customers";
import { customerInputSchema, type CustomerInput } from "../../lib/schemas";
import { CUSTOMER_STATUSES, CUSTOMER_STATUS_LABELS } from "../../types";

type CustomerFormValues = z.input<typeof customerInputSchema>;

export const EMPTY_CUSTOMER_FORM_VALUES: CustomerFormValues = {
  name: "",
  email: "",
  phone: "",
  company: "",
  jobTitle: "",
  status: "lead",
};

type CustomerFormProps = {
  defaultValues: CustomerFormValues;
  submitLabel: string;
  pendingLabel: string;
  /** Saves the customer. A rejection is shown inline and keeps the form open. */
  onSubmit: (values: CustomerInput) => Promise<unknown>;
  onCancel: () => void;
};

function Required() {
  return (
    <span aria-hidden className="text-destructive">
      *
    </span>
  );
}

/** The add/edit customer form; both dialogs render this with different defaults. */
export function CustomerForm({
  defaultValues,
  submitLabel,
  pendingLabel,
  onSubmit,
  onCancel,
}: CustomerFormProps) {
  const companyListId = useId();
  const companies = useCompanies();
  const form = useForm<CustomerFormValues, unknown, CustomerInput>({
    resolver: zodResolver(customerInputSchema),
    defaultValues,
  });
  const { isSubmitting, errors } = form.formState;

  const submit = submitOnce(form, async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      applySubmitError(form, error);
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Full name <Required />
              </FormLabel>
              <FormControl>
                <Input {...field} autoComplete="off" aria-required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Email <Required />
                </FormLabel>
                <FormControl>
                  <Input {...field} type="email" autoComplete="off" aria-required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Phone <Required />
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="tel"
                    autoComplete="off"
                    placeholder="+1 (415) 555-0100"
                    aria-required
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Company <Required />
                </FormLabel>
                <FormControl>
                  {/* Suggests existing companies but accepts a new one. */}
                  <Input {...field} list={companyListId} autoComplete="off" aria-required />
                </FormControl>
                <datalist id={companyListId}>
                  {companies.data?.map((company) => (
                    <option key={company} value={company} />
                  ))}
                </datalist>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="jobTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job title</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Status <Required />
              </FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full sm:w-1/2" ref={field.ref} onBlur={field.onBlur}>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CUSTOMER_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {CUSTOMER_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {errors.root?.message && (
          <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
            {errors.root.message}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2Icon className="animate-spin" />}
            {isSubmitting ? pendingLabel : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
