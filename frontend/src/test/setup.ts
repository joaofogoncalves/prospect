// Runs before each test file (see vitest.config.ts -> setupFiles).
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Registers jest-dom matchers (toBeInTheDocument, toBeDisabled, ...) on vitest's expect.
import "@testing-library/jest-dom/vitest";

// Recharts measures its container with ResizeObserver, which jsdom lacks. A
// no-op shim lets chart components mount in component tests (the Dashboard test
// also mocks ResponsiveContainer to give them concrete dimensions).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// Unmount React trees between tests so the DOM doesn't leak across cases.
afterEach(() => cleanup());
