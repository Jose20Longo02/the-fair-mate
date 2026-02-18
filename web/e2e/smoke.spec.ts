import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads and shows headline", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /play where every game counts/i })).toBeVisible();
  });

  test("has link to register", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /register|sign up|crear/i }).first()).toBeVisible();
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /log in|login|iniciar/i }).first()).toBeVisible({ timeout: 5000 });
  });
});
