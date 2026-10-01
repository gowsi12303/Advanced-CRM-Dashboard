"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/api-client";
import { applySubmitError, submitOnce } from "@/lib/form-errors";
import { toDateTimeLocalValue } from "@/lib/format";
import { useReturnFocus } from "@/lib/use-return-focus";

import { useLogContact } from "../../hooks/use-customer-mutations";
import { contactFormSchema, type ContactFormValues } from "../../lib/schemas";
import {
  CONTACT_METHODS,
  CONTACT_METHOD_LABELS,
  type Customer,
} from "../../types";

export type CustomerRef = Pick<Customer, "id" | "name">;

type LogContactDialogProps = {
  /** Null while closed. */
  customer: CustomerRef | null;
  onClose: () => void;
};

type ContactFormInput = z.input<typeof contactFormSchema>;

function LogContactForm({
  customer,
  onClose,
}: {
  customer: CustomerRef;
  onClose: () => void;
}) {
  const logContact = useLogContact();
  // Captured once when the form opens; also the latest time that can be picked.
  const [openedAt] = useState(() => toDateTimeLocalValue(new Date()));
  const form = useForm<ContactFormInput, unknown, ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    // `method` is left unset so the user has to choose one.
    defaultValues: { contactedAt: openedAt, note: "" },
  });
  const { isSubmitting, errors } = form.formState;

  const submit = submitOnce(form, async ({ method, contactedAt, note }) => {
    try {
      await logContact.mutateAsync({
        id: customer.id,
        input: {
          method,
          contactedAt: new Date(contactedAt).toISOString(),
          ...(note && { note }),
        },
      });
      onClose();
      toast.success(
        `Logged ${CONTACT_METHOD_LABELS[method].toLowerCase()} with ${customer.name}`,
      );
    } catch (error) {
      toast.error("Couldn't log the contact", {
        description: getErrorMessage(error),
      });
      applySubmitError(form, error);
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Method <span aria-hidden className="text-destructive">*</span>
                </FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full" ref={field.ref} onBlur={field.onBlur}>
                      <SelectValue placeholder="Select a method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CONTACT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {CONTACT_METHOD_LABELS[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contactedAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Date and time <span aria-hidden className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} type="datetime-local" max={openedAt} aria-required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} placeholder="What was discussed?" />
              </FormControl>
              <FormDescription>Optional. Saved to the customer&apos;s notes.</FormDescription>
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
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2Icon className="animate-spin" />}
            {isSubmitting ? "Logging…" : "Log contact"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export function LogContactDialog({ customer, onClose }: LogContactDialogProps) {
  const returnFocus = useReturnFocus(customer !== null);

  return (
    <Dialog
      open={customer !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
        onCloseAutoFocus={returnFocus}
      >
        <DialogHeader>
          <DialogTitle>Log contact</DialogTitle>
          <DialogDescription>
            {customer
              ? `Record a contact with ${customer.name}. This updates their last-contact details.`
              : "Record a contact with this customer."}
          </DialogDescription>
        </DialogHeader>
        {customer && <LogContactForm customer={customer} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
