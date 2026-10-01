import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Whole-page tests run several files in parallel; give `findBy`/`waitFor` room
// so a busy machine does not turn into a false failure.
configure({ asyncUtilTimeout: 10_000 });

// Component tests call the real API route handlers; skip their artificial latency.
process.env.MOCK_API_DELAY_MS = "0";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// jsdom lacks a few DOM APIs that Radix UI primitives call.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

// No media queries in jsdom: report "nothing matches" (a wide, light-themed screen).
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

globalThis.ResizeObserver ??= class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
