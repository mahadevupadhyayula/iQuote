import { expect, test } from "@playwright/test";

const requestText = [
  "Northstar Mining needs a customer quote for 6 HX-500 hydraulic pumps.",
  "Ship the order to Butte, Montana by September 30, 2026.",
  "Requested discount is 0%.",
  "If one warehouse cannot cover all units, propose split fulfillment, a later delivery date, or a seeded replacement product option.",
].join("\n");

test.describe("scenario C: inventory exception resolution", () => {
  test("proposes split fulfillment when requested quantity exceeds one warehouse, confirms inventory resolution, recalculates, and updates readiness", async ({ page, request }) => {
    const resetResponse = await request.post("/api/demo/reset");
    expect(resetResponse.ok(), await resetResponse.text()).toBeTruthy();

    await page.goto("/quotes/new");
    await page.getByLabel("Customer name").fill("Northstar Mining");
    await page.getByLabel("Customer email").fill("procurement@northstar.example");
    await page.getByLabel("Company domain").fill("northstar.example");
    await page.getByLabel("Opportunity").fill("Butte hydraulic pump replenishment");
    await page.getByLabel("Currency").fill("USD");
    await page.getByLabel("Valid until").fill("2026-09-30");
    await page.getByLabel("Request text").fill(requestText);

    await page.getByRole("button", { name: /extract and build quote/i }).click();

    const createdAlert = page.getByText(/Draft Q-\d+ created/i);
    await expect(createdAlert).toBeVisible({ timeout: 30_000 });
    const quoteNumber = (await createdAlert.textContent())?.match(/Q-\d+/)?.[0];
    expect(quoteNumber).toBeTruthy();

    await expect(page.getByText("HX-500")).toBeVisible();
    await expect(page.getByText(/Qty:\s*6/i)).toBeVisible();

    await page.goto("/quotes");
    const quoteRow = page.getByRole("row").filter({ hasText: quoteNumber! });
    await expect(quoteRow).toContainText("Northstar Mining");
    await quoteRow.getByRole("link", { name: /open quote/i }).click();

    await expect(page.getByRole("heading", { name: quoteNumber! })).toBeVisible();
    await expect(page.getByText("Northstar Mining")).toBeVisible();
    await expect(page.getByText("HX-500")).toBeVisible();
    await expect(page.getByText("Butte, MT")).toBeVisible();
    await expect(page.getByText("Sep 30, 2026")).toBeVisible();
    await expect(page.getByText("Unresolved")).toBeVisible();
    await expect(page.getByText("Complete inventory selection to calculate quote totals.")).toBeVisible();

    await page.getByRole("button", { name: /use recommended/i }).first().click();

    await expect(page.getByText("✓ Applied")).toBeVisible();
    await expect(page.getByRole("button", { name: /use recommended/i })).toHaveCount(0);
    await expect(page.getByText(/SEA-01/i)).toBeVisible();
    await expect(page.getByText(/DEN-01/i)).toBeVisible();
    await expect(page.getByText("Pricing resolved")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quote Summary" })).toBeVisible();
    await expect(page.getByText("Total")).toBeVisible();

    await page.getByRole("button", { name: /^continue$/i }).click();
    await expect(page).toHaveURL(/\/quotes\/[^/]+\/generate$/);
  });
});
