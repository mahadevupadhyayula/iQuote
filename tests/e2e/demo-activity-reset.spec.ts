import { expect, test } from "@playwright/test";

const requestText = [
  "Atlas Manufacturing needs a customer quote for 1 AX-200 compressor.",
  "Ship the order to Dallas, Texas by September 15, 2026.",
  "Requested discount must be 5%.",
].join("\n");

test.describe("demo activity reset", () => {
  test("clears generated quote activity from the queue and preserves reference data for a new quote", async ({ page, request }) => {
    const fullResetResponse = await request.post("/api/demo/reset");
    expect(fullResetResponse.ok(), await fullResetResponse.text()).toBeTruthy();

    await page.goto("/quotes/new");
    await page.getByLabel("Customer name").fill("Atlas Manufacturing");
    await page.getByLabel("Customer email").fill("buyer@atlas.example");
    await page.getByLabel("Company domain").fill("atlas.example");
    await page.getByLabel("Opportunity").fill("Reset demo validation");
    await page.getByLabel("Currency").fill("USD");
    await page.getByLabel("Valid until").fill("2026-09-15");
    await page.getByLabel("Request text").fill(requestText);
    await page.getByRole("button", { name: /extract and build quote/i }).click();

    const createdAlert = page.getByText(/Draft Q-\d+ created/i);
    await expect(createdAlert).toBeVisible({ timeout: 30_000 });
    const quoteNumber = (await createdAlert.textContent())?.match(/Q-\d+/)?.[0];
    expect(quoteNumber).toBeTruthy();

    await page.goto("/quotes");
    await expect(page.getByRole("row").filter({ hasText: quoteNumber! })).toBeVisible();

    await page.getByRole("button", { name: /^reset demo$/i }).click();
    await expect(page.getByRole("dialog", { name: "Reset demo activity?" })).toBeVisible();
    await expect(page.getByText(/Customers, products, prices, inventory, and discount policies will remain available/i)).toBeVisible();
    await page.getByRole("dialog", { name: "Reset demo activity?" }).getByRole("button", { name: /^reset demo$/i }).click();

    await expect(page.getByText(/Demo reset complete|Demo is already clean/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("No quotes yet")).toBeVisible();
    await expect(page.getByText("Create the first quote to start the workspace flow.")).toBeVisible();
    await expect(page.getByText(quoteNumber!)).toHaveCount(0);

    await page.getByRole("link", { name: /create quote/i }).first().click();
    await page.getByLabel("Customer name").fill("Atlas Manufacturing");
    await page.getByLabel("Customer email").fill("buyer@atlas.example");
    await page.getByLabel("Company domain").fill("atlas.example");
    await page.getByLabel("Opportunity").fill("Reference data still resolves");
    await page.getByLabel("Currency").fill("USD");
    await page.getByLabel("Valid until").fill("2026-09-15");
    await page.getByLabel("Request text").fill(requestText);
    await page.getByRole("button", { name: /extract and build quote/i }).click();

    await expect(page.getByText(/Draft Q-\d+ created/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("AX-200")).toBeVisible();
    await expect(page.getByText("Pricing resolved")).toBeVisible();
    await expect(page.getByText(/Recommended fulfilment/i)).toBeVisible();
  });
});
