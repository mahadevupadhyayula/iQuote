import { expect, test, type Page } from "@playwright/test";

const requestText = [
  "Northstar Mining needs a customer quote for 6 HX-500 hydraulic pumps.",
  "Ship the order to Butte, Montana by September 30, 2026.",
  "Requested discount is 0%.",
  "If one warehouse cannot cover all units, propose split fulfillment, a later delivery date, or a seeded replacement product option.",
].join("\n");

const quoteSummaryValue = (label: string) =>
  new RegExp(`${label}\\s*(-?\\$[\\d,]+\\.\\d{2})`, "i");

const getSummaryAmount = async (page: Page, label: string) => {
  const summary = page.locator("div").filter({ hasText: "Quote Summary" }).first();
  const text = (await summary.textContent()) ?? "";
  const match = text.match(quoteSummaryValue(label));
  expect(match, `Expected Quote Summary to include ${label} amount. Text was: ${text}`).toBeTruthy();
  return match![1];
};

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

    await page.getByRole("button", { name: /create draft and run extraction/i }).click();

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
    await expect(page.getByText(/Inventory must be selected for HX-500/i)).toBeVisible();
    await expect(page.getByText("Unresolved")).toBeVisible();

    const originalSubtotal = await getSummaryAmount(page, "Subtotal");
    const originalTotal = await getSummaryAmount(page, "Total");

    await page.getByRole("button", { name: /use recommended/i }).first().click();

    await expect(page.getByText("Inventory has a saved recommendation")).toBeVisible();
    await expect(page.getByText("Recommended")).toBeVisible();
    await expect(page.getByText(/split fulfillment/i)).toBeVisible();
    await expect(page.getByText(/SEA-01/i)).toBeVisible();
    await expect(page.getByText(/DEN-01/i)).toBeVisible();
    await expect(page.getByText("Inventory has been resolved.")).toBeVisible();

    await page.getByLabel("Correction note").fill("confirmed split fulfillment across seeded warehouses");
    await page.getByRole("button", { name: /apply corrections/i }).click();
    await expect(page.getByText("Corrections applied.")).toBeVisible();
    expect(await getSummaryAmount(page, "Subtotal")).toEqual(originalSubtotal);
    expect(await getSummaryAmount(page, "Total")).toEqual(originalTotal);

    await page.getByRole("button", { name: /^generate quote$/i }).click();
    await expect(page.getByText("Requirements complete")).toBeVisible();
    await expect(page.getByText("Product configuration valid")).toBeVisible();
    await expect(page.getByText("Pricing current")).toBeVisible();
    await expect(page.getByText("Inventory resolved")).toBeVisible();
    await expect(page.getByText("Margin within policy")).toBeVisible();
    await expect(page.getByText("Terms accepted")).toBeVisible();
    await expect(page.getByText(/^approved$/i)).toBeVisible();
  });
});
