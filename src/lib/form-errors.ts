import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

import { ApiError, getErrorMessage } from "@/lib/api-client";

/**
 * Wraps a react-hook-form submit handler so a second submit (Enter pressed
 * again, a double click) is ignored while the first is still in flight.
 */
export function submitOnce<Values extends FieldValues, Output>(
  form: UseFormReturn<Values, unknown, Output>,
  onValid: (values: Output) => Promise<void>,
): NonNullable<React.ComponentProps<"form">["onSubmit"]> {
  const submit = form.handleSubmit(onValid);
  return (event) => {
    if (form.formState.isSubmitting) {
      event.preventDefault();
      return;
    }
    void submit(event);
  };
}

/**
 * Shows a failed submission inside the form: per-field messages from the API
 * go under their fields, anything else becomes the form-level error.
 */
export function applySubmitError<Values extends FieldValues, Output>(
  form: UseFormReturn<Values, unknown, Output>,
  error: unknown,
) {
  const fields = Object.keys(form.getValues());
  let firstField: Path<Values> | undefined;

  if (error instanceof ApiError) {
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      if (!fields.includes(field) || messages.length === 0) continue;
      const path = field as Path<Values>;
      form.setError(path, { type: "server", message: messages[0] });
      firstField ??= path;
    }
  }

  if (firstField) {
    form.setFocus(firstField);
  } else {
    form.setError("root", { type: "server", message: getErrorMessage(error) });
  }
}
