import { test, expect } from "./fixtures";

const validUser = {
  token: "test-token",
  user: { id: "u1", email: "you@example.com", name: null },
};

const analyzed = {
  id: "i1",
  title: "Forecasting platform",
  description: "Build a platform",
  budgetRange: "$2M – $4M",
  timeline: "9 months",
  industry: "Retail",
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
  summary: "A retail enterprise wants a custom AI forecasting platform.",
  tags: ["ai-ml", "enterprise"],
  riskChecklist: ["Confirm data quality."],
  analyzedAt: "2026-05-28T01:00:00.000Z",
};

// Log in through the UI so protected routes are reachable.
async function login(page: import("@playwright/test").Page, apiMock: { login: (s: number, b: unknown) => void }) {
  apiMock.login(200, validUser);
  await page.goto("/login");
  await page.getByLabel("Email").fill("you@example.com");
  await page.getByLabel("Password").fill("correct-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

async function fillIntakeForm(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "New intake" }).click();
  await expect(page).toHaveURL("/intakes/new");
  await page.getByLabel("Title").fill("Forecasting platform");
  await page.getByLabel("Description").fill("Build a platform");
  await page.getByLabel("Budget range").fill("$2M – $4M");
  await page.getByLabel("Timeline").fill("9 months");
  await page.getByLabel("Industry").fill("Retail");
}

test.describe("intake create flow — analysis on creation", () => {
  test("create + analyze succeeds → lands on detail with AI analysis", async ({
    page,
    apiMock,
  }) => {
    await login(page, apiMock);
    await fillIntakeForm(page);

    apiMock.createIntake(201, analyzed); // create runs analysis server-side
    apiMock.getIntake(200, analyzed); // detail page loads it
    await page.getByRole("button", { name: "Create intake" }).click();

    await expect(page).toHaveURL("/intakes/i1");
    await expect(page.getByText("AI analysis")).toBeVisible();
    await expect(
      page.getByText("A retail enterprise wants a custom AI forecasting platform."),
    ).toBeVisible();
  });

  test("analysis fails on create → intake saved, error state, retry → detail", async ({
    page,
    apiMock,
  }) => {
    await login(page, apiMock);
    await fillIntakeForm(page);

    // Intake persisted but analysis failed.
    apiMock.createIntake(201, {
      ...analyzed,
      summary: null,
      tags: null,
      riskChecklist: null,
      analyzedAt: null,
      analysisError: "OpenAI request failed",
    });
    await page.getByRole("button", { name: "Create intake" }).click();

    // Recoverable error state — data is not lost.
    await expect(page.getByText("Intake saved — analysis failed")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveText(/OpenAI request failed/);

    // Retry analysis succeeds → navigate to detail.
    apiMock.analyzeIntake(200, analyzed);
    apiMock.getIntake(200, analyzed);
    await page.getByRole("button", { name: "Retry analysis" }).click();

    await expect(page).toHaveURL("/intakes/i1");
    await expect(page.getByText("AI analysis")).toBeVisible();
  });
});
