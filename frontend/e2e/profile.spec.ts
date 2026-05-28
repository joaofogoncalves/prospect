import { test, expect } from "./fixtures";

const validUser = {
  token: "test-token",
  user: {
    id: "u1",
    email: "you@example.com",
    name: "You Tester",
    createdAt: "2026-01-18T11:05:00.000Z",
  },
};

test("opens the profile from the account menu and shows account details", async ({
  page,
  apiMock,
}) => {
  apiMock.login(200, validUser);
  await page.goto("/login");
  await page.getByLabel("Email").fill("you@example.com");
  await page.getByLabel("Password").fill("correct-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  // Open the account dropdown (its label is the user's name) and go to Profile.
  await page.getByRole("button", { name: /You Tester/ }).click();
  await page.getByRole("menuitem", { name: "Profile" }).click();

  await expect(page).toHaveURL("/profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByText("you@example.com")).toBeVisible();
  await expect(page.getByText(/January 18, 2026/)).toBeVisible();
});
