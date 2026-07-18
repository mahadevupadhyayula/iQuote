import { expect, test } from "@playwright/test";

test.describe("home route walkthrough", () => {
  test("loads the landing route and primary message", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /capture ideas worth repeating/i })).toBeVisible();
    await expect(page.getByText(/next\.js app router starter/i)).toBeVisible();
  });
});
