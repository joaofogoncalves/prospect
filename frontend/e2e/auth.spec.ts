import { test, expect } from "./fixtures";

const validUser = {
  token: "test-token",
  user: { id: "u1", email: "you@example.com", name: null },
};

test.describe("login flow — state transitions", () => {
  test("error state, then recovery to the dashboard", async ({ page, apiMock }) => {
    // First submit fails (401), second submit succeeds (200).
    apiMock.login(401, { error: "Invalid email or password" });
    apiMock.login(200, validUser);

    await page.goto("/login");
    await page.getByLabel("Email").fill("you@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // error state
    await expect(page.getByRole("alert")).toHaveText("Invalid email or password");
    // recovered: the form is interactive again
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();

    // recovery: fix the password and resubmit
    await page.getByLabel("Password").fill("correct-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // success transition -> intake list, error gone. ("Sign out" now lives in
    // the account dropdown, so assert on a stable list-page marker instead.)
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("button", { name: "New intake" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("navigates between login and register", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome back")).toBeVisible();

    await page.getByRole("link", { name: "Create one" }).click();
    await expect(page).toHaveURL("/register");
    await expect(page.getByText("Create your account")).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();

    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/login");
    await expect(page.getByText("Welcome back")).toBeVisible();
  });
});
