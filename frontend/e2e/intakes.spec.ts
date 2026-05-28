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
  analysisStatus: "completed",
  analysisError: null,
  analysisRunCount: 0,
  userId: "u1",
  user: { id: "u1", name: null, email: "you@example.com" },
};

// The same intake mid-analysis (what create returns and the first poll sees).
const processing = {
  ...analyzed,
  summary: null,
  tags: null,
  riskChecklist: null,
  analyzedAt: null,
  analysisStatus: "processing",
};

// Analysis failed in the background; the poll surfaces this with a retry.
const failed = {
  ...processing,
  analysisStatus: "failed",
  analysisError: "OpenAI request failed",
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

// Another user's intake — readable by everyone, but not analyzable by u1.
const othersIntake = {
  id: "i2",
  title: "Logistics route optimizer",
  description: "Optimize delivery routes",
  budgetRange: "$500K – $1M",
  timeline: "6 months",
  industry: "Logistics",
  createdAt: "2026-05-20T00:00:00.000Z",
  updatedAt: "2026-05-20T00:00:00.000Z",
  summary: null,
  tags: null,
  riskChecklist: null,
  analyzedAt: null,
  analysisStatus: "pending",
  analysisError: null,
  analysisRunCount: 0,
  userId: "u2",
  user: { id: "u2", name: "Dana Ruiz", email: "dana@example.com" },
};

async function fillIntakeForm(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "New intake" }).click();
  await expect(page).toHaveURL("/intakes/new");
  await page.getByLabel("Title").fill("Forecasting platform");
  await page.getByLabel("Description").fill("Build a platform");
  await page.getByLabel("Budget range").fill("$2M – $4M");
  await page.getByLabel("Timeline").fill("9 months");
  await page.getByLabel("Industry").fill("Retail");
}

test.describe("intake create flow — async analysis + polling", () => {
  test("create → detail shows Analyzing… → poll resolves to the analysis", async ({
    page,
    apiMock,
  }) => {
    await login(page, apiMock);
    await fillIntakeForm(page);

    // Create returns immediately (analysis pending); the detail page polls
    // GET /intakes/:id — first "processing", then "completed".
    apiMock.createIntake(201, processing);
    apiMock.getIntake(200, processing); // initial load
    apiMock.getIntake(200, analyzed); // next poll: done
    await page.getByRole("button", { name: "Create intake" }).click();

    await expect(page).toHaveURL("/intakes/i1");
    // Polling carries the page from "processing" to the resolved analysis. (The
    // transient "Analyzing…" spinner is asserted in the IntakeDetail unit test,
    // where it isn't racing the poll under the dev server's StrictMode remount.)
    await expect(
      page.getByText("A retail enterprise wants a custom AI forecasting platform."),
    ).toBeVisible();
  });

  test("background analysis fails → detail shows error + Retry → poll resolves", async ({
    page,
    apiMock,
  }) => {
    await login(page, apiMock);
    await fillIntakeForm(page);

    apiMock.createIntake(201, processing);
    apiMock.getIntake(200, processing); // initial load
    apiMock.getIntake(200, failed); // poll: analysis failed
    apiMock.getIntake(200, analyzed); // poll after retry: done
    await page.getByRole("button", { name: "Create intake" }).click();

    await expect(page).toHaveURL("/intakes/i1");
    await expect(page.getByRole("alert")).toHaveText(/OpenAI request failed/);
    await expect(page.getByText(/analyses left/)).toBeVisible();

    // Retry re-runs analysis (202 → processing); the poll then resolves it.
    apiMock.analyzeIntake(202, processing);
    await page.getByRole("button", { name: "Try again" }).click();

    await expect(
      page.getByText("A retail enterprise wants a custom AI forecasting platform."),
    ).toBeVisible();
  });
});

test.describe("collaborative list — mine vs. others, read-only for others", () => {
  test("list splits own intakes from the rest; opening another's is read-only", async ({
    page,
    apiMock,
  }) => {
    // Queue the mixed list before login so it's served when the list mounts.
    apiMock.intakes(200, [analyzed, othersIntake]);
    await login(page, apiMock);

    // My intake lands under "My intakes"; the other under "All other intakes"
    // with its creator shown.
    await expect(
      page.getByRole("link", { name: "Forecasting platform" }),
    ).toBeVisible();
    const othersLink = page.getByRole("link", {
      name: "Logistics route optimizer",
    });
    await expect(othersLink).toBeVisible();
    await expect(page.getByRole("cell", { name: "Dana Ruiz" })).toBeVisible();

    // Filtering by title narrows the lists.
    await page.getByLabel("Search intakes").fill("logistics");
    await expect(
      page.getByRole("link", { name: "Forecasting platform" }),
    ).toBeHidden();
    await expect(othersLink).toBeVisible();
    await page.getByLabel("Search intakes").fill("");

    // Opening someone else's intake: detail is read-only — no analysis action.
    apiMock.getIntake(200, othersIntake);
    await othersLink.click();
    await expect(page).toHaveURL("/intakes/i2");
    await expect(page.getByText("Submitted by Dana Ruiz")).toBeVisible();
    await expect(
      page.getByText("Only the person who submitted this intake can run its analysis."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Generate analysis" }),
    ).toHaveCount(0);
  });

  test("searching a tag filters the list and reveals the matched tag", async ({
    page,
    apiMock,
  }) => {
    apiMock.intakes(200, [analyzed, othersIntake]); // analyzed is tagged ai-ml/enterprise
    await login(page, apiMock);

    const tagged = page.getByRole("link", { name: "Forecasting platform" });
    const untagged = page.getByRole("link", { name: "Logistics route optimizer" });
    await expect(tagged).toBeVisible();

    // Tags aren't shown until a search matches one.
    await expect(page.getByText("ai-ml")).toBeHidden();

    await page.getByLabel("Search intakes").fill("ai-ml");

    // The tagged intake stays (matched on its tag) and surfaces the matched tag;
    // the untagged one (no title/industry/tag match) drops out.
    await expect(tagged).toBeVisible();
    await expect(untagged).toBeHidden();
    await expect(page.getByText("matched")).toBeVisible();
    await expect(page.getByText("ai-ml")).toBeVisible();
  });

  test("the other-intakes list paginates", async ({ page, apiMock }) => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      ...othersIntake,
      id: `o${i}`,
      title: `Other intake ${i}`,
    }));
    apiMock.intakes(200, [analyzed, ...many]);
    await login(page, apiMock);

    await expect(page.getByText("Showing 1–8 of 10")).toBeVisible();
    await page.getByRole("button", { name: "Previous" }).isDisabled();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Showing 9–10 of 10")).toBeVisible();
  });
});
