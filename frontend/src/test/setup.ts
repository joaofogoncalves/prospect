// Runs before each test file (see vitest.config.ts -> setupFiles).
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Registers jest-dom matchers (toBeInTheDocument, toBeDisabled, ...) on vitest's expect.
import "@testing-library/jest-dom/vitest";

// Unmount React trees between tests so the DOM doesn't leak across cases.
afterEach(() => cleanup());
