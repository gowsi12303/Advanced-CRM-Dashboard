"use client";

import { useId, useState } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

import { useAddNote, useDeleteNote } from "../../hooks/use-customer-mutations";
import { useCustomerNotes } from "../../hooks/use-customers";
import { noteInputSchema } from "../../lib/schemas";
import type { CustomerNote } from "../../types";

function AddNoteForm({ customerId }: { customerId: string }) {
  const id = useId();
  const addNote = useAddNote();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit: React.ComponentProps<"form">["onSubmit"] = (event) => {
    event.preventDefault();
    const parsed = noteInputSchema.safeParse({ body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a note");
      return;
    }

    setError(null);
    addNote.mutate(
      { customerId, input: parsed.data },
      {
        onSuccess: () => {
          setBody("");
          toast.success("Note added");
        },
        onError: (cause) => {
          const fieldError =
            cause instanceof ApiError ? cause.fieldErrors.body?.[0] : undefined;
          setError(fieldError ?? getErrorMessage(cause));
          toast.error("Couldn't add the note", {
            description: getErrorMessage(cause),
          });
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2">
      <label htmlFor={`${id}-body`} className="sr-only">
        New note
      </label>
      <Textarea
        id={`${id}-body`}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          setError(null);
        }}
        rows={3}
        placeholder="Add a note about this customer…"
        aria-invalid={error !== null}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <div className="flex items-start justify-between gap-3">
        <p id={`${id}-error`} role={error ? "alert" : undefined} className="text-sm text-destructive">
          {error}
        </p>
        <Button type="submit" size="sm" disabled={addNote.isPending}>
          {addNote.isPending && <Loader2Icon className="animate-spin" />}
          {addNote.isPending ? "Adding…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}

export function CustomerNotes({ customerId }: { customerId: string }) {
  const notes = useCustomerNotes(customerId);
  const deleteNote = useDeleteNote();
  const [deleting, setDeleting] = useState<CustomerNote | null>(null);

  const handleDelete = () => {
    if (!deleting) return;
    deleteNote.mutate(
      { customerId, noteId: deleting.id },
      {
        onSuccess: () => {
          setDeleting(null);
          toast.success("Note deleted");
        },
        onError: (error) =>
          toast.error("Couldn't delete the note", {
            description: getErrorMessage(error),
          }),
      },
    );
  };

  return (
    <section className="space-y-3" aria-labelledby="customer-notes-heading">
      <h3 id="customer-notes-heading" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Notes &amp; interactions{" "}
        {notes.data && notes.data.length > 0 && (
          <span className="font-normal text-muted-foreground">
            ({notes.data.length})
          </span>
        )}
      </h3>

      <AddNoteForm customerId={customerId} />

      {notes.isPending ? (
        <div className="space-y-2" aria-busy aria-label="Loading notes">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : notes.isError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 p-3 text-sm"
        >
          <span>Couldn&apos;t load notes. {getErrorMessage(notes.error)}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => notes.refetch()}
            disabled={notes.isFetching}
          >
            Retry
          </Button>
        </div>
      ) : notes.data.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No notes yet.
        </p>
      ) : (
        <ol className="space-y-2" aria-label="Notes">
          {notes.data.map((note) => (
            <li key={note.id} className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <time
                  dateTime={note.createdAt}
                  className="text-xs text-muted-foreground"
                >
                  {formatDateTime(note.createdAt)}
                </time>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setDeleting(note)}
                  className="-mt-1 -mr-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2Icon />
                  <span className="sr-only">
                    Delete note from {formatDateTime(note.createdAt)}
                  </span>
                </Button>
              </div>
              <p className="mt-1 text-sm break-words whitespace-pre-wrap">
                {note.body}
              </p>
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete note?"
        description="This note will be permanently removed from the customer's record."
        confirmLabel="Delete note"
        pendingLabel="Deleting…"
        isPending={deleteNote.isPending}
        onConfirm={handleDelete}
        destructive
      />
    </section>
  );
}
