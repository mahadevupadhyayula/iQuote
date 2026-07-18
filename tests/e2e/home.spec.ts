import { expect, test } from "@playwright/test";

test.describe("home route walkthrough", () => {
  test("routes the landing page into the quote workspace", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/quotes$/);
    await expect(page.getByRole("heading", { name: /recent quotes/i })).toBeVisible();
  });
});
