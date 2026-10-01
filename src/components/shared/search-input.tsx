"use client";

import { useEffect, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  /** The committed search term (e.g. from the URL). */
  value: string;
  /** Called with the trimmed term once the user pauses typing. */
  onChange: (value: string) => void;
  delay?: number;
  placeholder?: string;
  "aria-label": string;
  className?: string;
  /** Lets a parent focus the field, e.g. from a keyboard shortcut. */
  ref?: React.Ref<HTMLInputElement>;
  /** A key shown inside the empty field as a hint, e.g. "/". */
  shortcutHint?: string;
};

/** A text input that reports changes only after the user stops typing. */
export function SearchInput({
  value,
  onChange,
  delay = 300,
  placeholder,
  "aria-label": ariaLabel,
  className,
  ref,
  shortcutHint,
}: SearchInputProps) {
  const [draft, setDraft] = useState(value);
  const [emitted, setEmitted] = useState(value);

  // Follow outside changes to `value` (back/forward, "clear search"), but not
  // the echo of what this input just emitted, which would clobber characters
  // typed since then.
  const [previousValue, setPreviousValue] = useState(value);
  if (value !== previousValue) {
    setPreviousValue(value);
    if (value !== emitted) {
      setDraft(value);
      setEmitted(value);
    }
  }

  const term = draft.trim();

  useEffect(() => {
    if (term === emitted) return;
    const timer = setTimeout(() => {
      setEmitted(term);
      onChange(term);
    }, delay);
    return () => clearTimeout(timer);
  }, [term, emitted, delay, onChange]);

  const clear = () => {
    setDraft("");
    setEmitted("");
    onChange("");
  };

  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        type="search"
        aria-keyshortcuts={shortcutHint}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        // The native clear button is hidden in favour of the one below.
        className="px-8 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {!draft && shortcutHint && (
        <kbd
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[0.7rem] text-muted-foreground sm:block"
        >
          {shortcutHint}
        </kbd>
      )}
      {draft && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={clear}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
        >
          <XIcon />
          <span className="sr-only">Clear search</span>
        </Button>
      )}
    </div>
  );
}
