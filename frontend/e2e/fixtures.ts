import { test as base, expect, type Route } from "@playwright/test";

// Queue canned API responses so a test can script a flow — e.g. a 401 followed
// by a 200 to exercise error → recovery. Each call to the endpoint shifts the
// next queued response; if the queue is empty, the fallback is used.
//
//   test("...", async ({ page, apiMock }) => {
//     apiMock.login(401, { error: "Invalid email or password" });
//     apiMock.login(200, { token: "t", user: { id: "1", email: "a@b.c", name: null } });
//     await page.goto("/login");
//     ...
//   });

type Queued = { status: number; body: unknown };

export type ApiMock = {
  login: (status: number, body: unknown) => void;
  register: (status: number, body: unknown) => void;
  /** Queue a response for the GET /api/intakes list (default: 200 []). */
  intakes: (status: number, body: unknown) => void;
  /** Queue a response for POST /api/intakes (create + analyze). */
  createIntake: (status: number, body: unknown) => void;
  /** Queue a response for GET /api/intakes/:id (detail). */
  getIntake: (status: number, body: unknown) => void;
  /** Queue a response for POST /api/intakes/:id/analyze (retry). */
  analyzeIntake: (status: number, body: unknown) => void;
};

export const test = base.extend<{ apiMock: ApiMock }>({
  apiMock: async ({ page }, use) => {
    const queues: Record<string, Queued[]> = {
      login: [],
      register: [],
      intakes: [],
      createIntake: [],
      getIntake: [],
      analyzeIntake: [],
    };
    const fallback: Record<string, Queued> = {
      login: { status: 401, body: { error: "Invalid email or password" } },
      register: { status: 409, body: { error: "Email already registered" } },
      // Default so a successful login lands on a working (empty) dashboard.
      intakes: { status: 200, body: [] },
      createIntake: { status: 500, body: { error: "no createIntake queued" } },
      getIntake: { status: 404, body: { error: "Intake not found" } },
      analyzeIntake: { status: 502, body: { error: "no analyzeIntake queued" } },
    };

    // Sticky: once a response has been used, repeated calls reuse the last one
    // (until a new one is queued). This keeps tests robust against refetches —
    // e.g. React StrictMode double-mounting a view in dev.
    const lastUsed: Record<string, Queued> = {};
    const handle = (key: string) => async (route: Route) => {
      const next = queues[key].shift() ?? lastUsed[key] ?? fallback[key];
      lastUsed[key] = next;
      await route.fulfill({
        status: next.status,
        contentType: "application/json",
        body: JSON.stringify(next.body),
      });
    };

    // Match the API regardless of host/port (VITE_API_URL). Regexes are
    // disjoint, so registration order doesn't matter.
    await page.route("**/api/auth/login", handle("login"));
    await page.route("**/api/auth/register", handle("register"));
    // GET = list, POST = create (analysis runs server-side on create).
    await page.route(/\/api\/intakes$/, async (route) => {
      return handle(route.request().method() === "POST" ? "createIntake" : "intakes")(
        route,
      );
    });
    await page.route(/\/api\/intakes\/[^/]+\/analyze$/, handle("analyzeIntake"));
    await page.route(/\/api\/intakes\/[^/]+$/, handle("getIntake"));

    await use({
      login: (status, body) => queues.login.push({ status, body }),
      register: (status, body) => queues.register.push({ status, body }),
      intakes: (status, body) => queues.intakes.push({ status, body }),
      createIntake: (status, body) => queues.createIntake.push({ status, body }),
      getIntake: (status, body) => queues.getIntake.push({ status, body }),
      analyzeIntake: (status, body) => queues.analyzeIntake.push({ status, body }),
    });
  },
});

export { expect };
