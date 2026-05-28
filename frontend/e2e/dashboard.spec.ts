import { test, expect } from "./fixtures";

const validUser = {
  token: "test-token",
  user: { id: "u1", email: "you@example.com", name: null },
};

const populatedStats = {
  totals: { intakes: 5, analyzed: 3, notAnalyzed: 2, contributors: 2 },
  byStatus: [
    { status: "completed", count: 3 },
    { status: "pending", count: 2 },
  ],
  byTag: [
    { tag: "ai-ml", count: 4 },
    { tag: "enterprise", count: 2 },
  ],
  byIndustry: [{ industry: "Retail", count: 5 }],
  leaderboard: [
    { userId: "u1", name: "Ada", email: "ada@x.io", count: 3, analyzedCount: 2 },
    { userId: "u2", name: null, email: "rob@x.io", count: 2, analyzedCount: 1 },
  ],
  overTime: [
    { date: "2026-05-27", count: 2 },
    { date: "2026-05-28", count: 3 },
  ],
};

async function login(
  page: import("@playwright/test").Page,
  apiMock: { login: (s: number, b: unknown) => void },
) {
  apiMock.login(200, validUser);
  await page.goto("/login");
  await page.getByLabel("Email").fill("you@example.com");
  await page.getByLabel("Password").fill("correct-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

test("navigates from the list to the dashboard and renders stats", async ({
  page,
  apiMock,
}) => {
  await login(page, apiMock);

  apiMock.stats(200, populatedStats);
  await page.getByRole("link", { name: "Dashboard" }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  // KPI cards.
  await expect(page.getByText("Total intakes")).toBeVisible();
  await expect(page.getByText("Contributors")).toBeVisible();

  // Leaderboard ranking, with the email fallback for the unnamed user.
  const table = page.getByRole("table", { name: "Leaderboard ranking" });
  await expect(table.getByText("Ada")).toBeVisible();
  await expect(table.getByText("rob@x.io")).toBeVisible();

  // Export controls are present for a populated dashboard.
  await expect(
    page.getByRole("button", { name: "Export report" }),
  ).toBeVisible();
});

test("shows the empty state when there are no intakes", async ({
  page,
  apiMock,
}) => {
  await login(page, apiMock);

  // No stats queued → the fixture's zeroed default applies.
  await page.getByRole("link", { name: "Dashboard" }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByText("No intakes yet")).toBeVisible();
});
