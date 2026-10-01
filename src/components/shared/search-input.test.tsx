import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SearchInput } from "./search-input";

function type(value: string) {
  fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("SearchInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports a change only after 300ms without typing", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} aria-label="Search" />);

    type("ve");
    advance(299);
    expect(onChange).not.toHaveBeenCalled();

    // Typing again restarts the wait.
    type("vela");
    advance(299);
    expect(onChange).not.toHaveBeenCalled();

    advance(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("vela");
  });

  it("trims the term and ignores whitespace-only edits", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} aria-label="Search" />);

    type("   ");
    advance(300);
    expect(onChange).not.toHaveBeenCalled();

    type("  acme  ");
    advance(300);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("acme");
  });

  it("clears immediately, without waiting for the debounce", () => {
    const onChange = vi.fn();
    render(<SearchInput value="acme" onChange={onChange} aria-label="Search" />);

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("");
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("follows outside changes to the value", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SearchInput value="acme" onChange={onChange} aria-label="Search" />,
    );
    expect(screen.getByRole("searchbox")).toHaveValue("acme");

    rerender(<SearchInput value="" onChange={onChange} aria-label="Search" />);
    expect(screen.getByRole("searchbox")).toHaveValue("");
    advance(300);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps characters typed while an emitted value is echoed back", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SearchInput value="" onChange={onChange} aria-label="Search" />,
    );

    type("ab");
    advance(300);
    expect(onChange).toHaveBeenLastCalledWith("ab");

    // The user keeps typing before the parent echoes "ab" back.
    type("abc");
    rerender(<SearchInput value="ab" onChange={onChange} aria-label="Search" />);
    expect(screen.getByRole("searchbox")).toHaveValue("abc");

    advance(300);
    expect(onChange).toHaveBeenLastCalledWith("abc");
  });
});
