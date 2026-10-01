"use client";

import { useState } from "react";

/** Where focus should go back to, given what had focus when a dialog opened. */
function resolveReturnTarget(active: Element | null): HTMLElement | null {
  if (!(active instanceof HTMLElement) || active === document.body) return null;
  // A menu item disappears with its menu; return to the button that opened it.
  const menu = active.closest('[role="menu"]');
  if (menu) {
    const triggerId = menu.getAttribute("aria-labelledby");
    return triggerId ? document.getElementById(triggerId) : null;
  }
  return active;
}

/**
 * Focus restoration for dialogs that are opened by state rather than by a
 * Radix `Trigger`. Radix only knows where to send focus back to when it owns
 * the trigger; without one, focus is dropped on `<body>` when the dialog
 * closes and keyboard users lose their place.
 *
 * Pass the returned handler to the content's `onCloseAutoFocus`.
 */
export function useReturnFocus(open: boolean) {
  const [wasOpen, setWasOpen] = useState(open);
  const [returnTo, setReturnTo] = useState<HTMLElement | null>(null);

  // Captured as `open` flips to true, before the dialog mounts and takes focus.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setReturnTo(resolveReturnTarget(document.activeElement));
  }

  return (event: Event) => {
    // The element may be gone, e.g. the row of a customer that was deleted.
    if (returnTo?.isConnected) {
      event.preventDefault();
      returnTo.focus();
    }
  };
}
