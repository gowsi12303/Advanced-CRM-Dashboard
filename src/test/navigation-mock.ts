import { useMemo, useSyncExternalStore } from "react";

// A minimal in-memory stand-in for `next/navigation`, with a history stack, so
// components that keep state in the URL can be tested. Use it with:
//   vi.mock("next/navigation", () => import("@/test/navigation-mock"));

const PATHNAME = "/customers";
let entries = [""];
let index = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener());
}

function toSearch(href: string) {
  return new URL(href, "http://localhost").search.replace(/^\?/, "");
}

/** Resets history to a single entry, as if the page had been opened with this query string. */
export function setMockSearch(next: string) {
  entries = [next];
  index = 0;
  notify();
}

/** The current query string, without the leading "?". */
export function getMockSearch() {
  return entries[index];
}

/** Browser back button. */
export function mockBack() {
  if (index > 0) index -= 1;
  notify();
}

/** Browser forward button. */
export function mockForward() {
  if (index < entries.length - 1) index += 1;
  notify();
}

const router = {
  push: (href: string) => {
    entries = [...entries.slice(0, index + 1), toSearch(href)];
    index = entries.length - 1;
    notify();
  },
  replace: (href: string) => {
    entries = entries.map((entry, i) => (i === index ? toSearch(href) : entry));
    notify();
  },
};

export function useRouter() {
  return router;
}

export function usePathname() {
  return PATHNAME;
}

export function useSearchParams() {
  const current = useSyncExternalStore(subscribe, getMockSearch);
  return useMemo(() => new URLSearchParams(current), [current]);
}
