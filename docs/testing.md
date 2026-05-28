# Testing

The frontend has two complementary test layers. Both are **deterministic** — they
mock the API, so they don't need the backend running or a seeded database.

| Layer | Tool | Scope | Where |
| --- | --- | --- | --- |
| Component | **Vitest + React Testing Library** (jsdom) | A component's state machine in isolation | `frontend/src/**/*.test.tsx` |
| End-to-end | **Playwright** (real Chromium) | Full flows across pages/routes | `frontend/e2e/*.spec.ts` |

The guiding idea is to test **state transitions**, especially the path most likely
to break: **idle → submitting → error → recovery → success**. Error states and the
recovery out of them are first-class cases, not afterthoughts.

## Running

```bash
# from the repo root
npm run test          # Vitest (component) — fast, headless
npm run test:e2e      # Playwright (e2e) — auto-starts the Vite dev server

# from frontend/ you also get
npm run test:watch    # Vitest in watch mode
npm run test:e2e:ui   # Playwright's interactive UI runner
```

First-time only, install the browser Playwright drives:

```bash
cd frontend && npx playwright install chromium
```

## Layout

```
frontend/
├── vitest.config.ts          # jsdom env, setup file, src/**/*.test.tsx
├── playwright.config.ts       # baseURL :5173, auto-starts vite, e2e/ dir
├── src/
│   ├── test/
│   │   ├── setup.ts            # registers jest-dom matchers + cleanup
│   │   └── utils.tsx           # renderWithRouter(), deferred()
│   └── components/
│       └── AuthForm.test.tsx   # example component test
└── e2e/
    ├── fixtures.ts             # `test` extended with an `apiMock` fixture
    └── auth.spec.ts            # example e2e test
```

Test files are **excluded from `tsc`** (see `tsconfig.json` `exclude`), so they
never affect `npm run build`.

## Writing a component test (Vitest)

Mock the network at the `@/lib/api` boundary and render with the real providers via
`renderWithRouter`. Use `deferred()` to hold a request open so you can assert the
in-between **submitting** state before it settles.

```tsx
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRouter, deferred } from "@/test/utils";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => apiMock(...a),
  getToken: () => null,
  setToken: () => {},
}));

// ...render, drive with userEvent, assert role="alert" on failure,
//    then a queued success that navigates to a marker route.
```

See [`src/components/AuthForm.test.tsx`](../frontend/src/components/AuthForm.test.tsx)
for the full idle→submitting→error→recovery→success example.

## Writing an e2e test (Playwright)

Import `test`/`expect` from `./fixtures`. The `apiMock` fixture lets you **queue
responses per endpoint** — the first call shifts the first queued response — which
is how you script `error → recovery` (a 401 then a 200). A successful login lands
on the dashboard, so the fixture also serves an empty `GET /api/intakes` by default.

```ts
import { test, expect } from "./fixtures";

test("error then recovery", async ({ page, apiMock }) => {
  apiMock.login(401, { error: "Invalid email or password" });
  apiMock.login(200, { token: "t", user: { id: "1", email: "a@b.c", name: null } });

  await page.goto("/login");
  await page.getByLabel("Email").fill("a@b.c");
  await page.getByLabel("Password").fill("nope");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid email or password");

  await page.getByLabel("Password").fill("right");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});
```

To mock another endpoint, add a queue + route in
[`e2e/fixtures.ts`](../frontend/e2e/fixtures.ts) following the `login`/`intakes`
pattern.

## Testing pages with charts (Recharts)

Recharts measures its container with `ResizeObserver` and `ResponsiveContainer`
reports **0×0 in jsdom**, so chart internals never render. Two pieces make chart
pages testable (see `pages/Dashboard.test.tsx`):

- A `ResizeObserver` no-op shim lives in `src/test/setup.ts` (global, harmless
  elsewhere).
- **Mock `ResponsiveContainer`** in the test file to a fixed-size wrapper that passes
  concrete `width`/`height` to its child, so the chart mounts:
  ```ts
  vi.mock("recharts", async (importOriginal) => {
    const actual = await importOriginal<typeof import("recharts")>();
    const React = await import("react");
    return {
      ...actual,
      ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
        React.createElement("div", { style: { width: 800, height: 400 } },
          React.cloneElement(children, { width: 800, height: 400 })),
    };
  });
  ```

Assert on **real DOM** — KPI numbers, section titles, the leaderboard table rows, the
export buttons — never on chart pixels. The leaderboard table is the accessible
source of truth, so it's also what the test reads. Don't try to assert a PNG download
in jsdom (it can't rasterize the SVG); test the pure export helpers directly instead
(`lib/exportData.test.ts`).

## Conventions

- **Query by role/label**, not CSS — `getByRole("alert")`, `getByLabel("Email")`.
  This keeps tests aligned with what users (and assistive tech) actually see.
- **Assert the error UI explicitly** (`role="alert"`), then assert the form is
  interactive again — that's the "recovery" half of the transition.
- Playwright artifacts (`test-results/`, `playwright-report/`) and Vitest
  `coverage/` are gitignored.

> For driving the live app ad-hoc (vs. automated specs), see
> [preview-and-verification.md](./preview-and-verification.md).
