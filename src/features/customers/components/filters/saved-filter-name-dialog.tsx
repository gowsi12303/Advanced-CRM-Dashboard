"use client";

import { useId, useState } from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { useReturnFocus } from "@/lib/use-return-focus";

import { savedFilterNameSchema } from "../../lib/schemas";

type SavedFilterNameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initialName?: string;
  submitLabel: string;
  /** Saves the name; a rejection is shown inline and keeps the dialog open. */
  onSubmit: (name: string) => Promise<unknown>;
};

function NameForm({
  initialName = "",
  submitLabel,
  onSubmit,
  onDone,
}: Pick<SavedFilterNameDialogProps, "initialName" | "submitLabel" | "onSubmit"> & {
  onDone: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit: React.ComponentProps<"form">["onSubmit"] = async (event) => {
    event.preventDefault();
    // React events bubble through portals; don't submit a form this dialog
    // happens to be rendered inside (the filter panel).
    event.stopPropagation();
    const parsed = savedFilterNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid name");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(parsed.data);
      onDone();
    } catch (cause) {
      const fieldError =
        cause instanceof ApiError ? cause.fieldErrors.name?.[0] : undefined;
      setError(fieldError ?? getErrorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          placeholder="e.g. West coast prospects"
          autoComplete="off"
          autoFocus
          aria-invalid={error !== null}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error && (
          <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2Icon className="animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SavedFilterNameDialog({
  open,
  onOpenChange,
  title,
  description,
  ...form
}: SavedFilterNameDialogProps) {
  const returnFocus = useReturnFocus(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" onCloseAutoFocus={returnFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* Rendered only while open, so each opening starts from a clean form. */}
        <NameForm {...form} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
