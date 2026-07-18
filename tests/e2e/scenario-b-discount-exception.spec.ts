import { expect, test, type Page } from "@playwright/test";

const requestedDiscountBps = 1200;
const approvedDiscountBps = 1000;
const requestText = [
  "Atlas Manufacturing needs a quote for 4 AX-200 compressors.",
  "Ship the order to Dallas, Texas by September 15, 2026.",
  "Requested discount is 12%.",
  "Discount reason: competitive replacement opportunity.",
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

test.describe("scenario B: discount exception approval", () => {
  test("creates a product-manager approval, pauses the quote, modifies the discount, recalculates totals, and resumes generation readiness", async ({ page, request }) => {
    const resetResponse = await request.post("/api/demo/reset");
    expect(resetResponse.ok(), await resetResponse.text()).toBeTruthy();

    await page.goto("/quotes/new");
    await page.getByLabel("Customer name").fill("Atlas Manufacturing");
    await page.getByLabel("Customer email").fill("buyer@atlas.example");
    await page.getByLabel("Company domain").fill("atlas.example");
    await page.getByLabel("Opportunity").fill("Competitive replacement opportunity");
    await page.getByLabel("Currency").fill("USD");
    await page.getByLabel("Valid until").fill("2026-09-15");
    await page.getByLabel("Request text").fill(requestText);

    await page.getByRole("button", { name: /create draft and run extraction/i }).click();

    const createdAlert = page.getByText(/Draft Q-\d+ created/i);
    await expect(createdAlert).toBeVisible({ timeout: 30_000 });
    const quoteNumber = (await createdAlert.textContent())?.match(/Q-\d+/)?.[0];
    expect(quoteNumber).toBeTruthy();

    await expect(page.getByText("AX-200")).toBeVisible();
    await expect(page.getByText(/Qty:\s*4/i)).toBeVisible();

    await page.goto("/quotes");
    const quoteRow = page.getByRole("row").filter({ hasText: quoteNumber! });
    await expect(quoteRow).toContainText("Atlas Manufacturing");
    await quoteRow.getByRole("link", { name: /open quote/i }).click();

    await expect(page.getByRole("heading", { name: quoteNumber! })).toBeVisible();
    await expect(page.getByText("Atlas Manufacturing")).toBeVisible();
    await expect(page.getByText("AX-200")).toBeVisible();

    // Make the requested exception deterministic even if AI extraction omits the discount.
    await page.getByLabel("First-line discount bps").fill(String(requestedDiscountBps));
    await page.getByLabel("Correction note").fill("competitive replacement opportunity");
    await page.getByRole("button", { name: /apply corrections/i }).click();
    await expect(page.getByText("12%")).toBeVisible();

    await page.getByRole("button", { name: /use recommended/i }).first().click();
    await expect(page.getByText("Inventory has a saved recommendation")).toBeVisible();

    const originalDiscount = await getSummaryAmount(page, "Discount");
    const originalTotal = await getSummaryAmount(page, "Total");

    await page.getByRole("button", { name: /submit for approval/i }).click();
    await expect(page.getByText("pending approval")).toBeVisible();
    await expect(page.getByText(/product manager approval must be completed/i)).toBeVisible();

    const approvalLink = page.getByRole("link", { name: /open product manager approval/i });
    await expect(approvalLink).toBeVisible();
    await approvalLink.click();

    await expect(page.getByRole("heading", { name: quoteNumber! })).toBeVisible();
    await expect(page.getByText(/Required role\s*product manager/i)).toBeVisible();
    await expect(page.getByText(/Current status\s*pending approval/i)).toBeVisible();
    await expect(page.getByText("12%")).toBeVisible();

    await page.getByLabel("Modified discount (bps)").fill(String(approvedDiscountBps));
    await page.getByLabel("Comments").fill("Approve at 10% to preserve margin while matching the competitive replacement opportunity.");
    await page.getByRole("button", { name: /approve modified/i }).click();
    await expect(page.getByText("Decision saved. The quote workflow has resumed.")).toBeVisible();
    await expect(page.getByText(/approved/i)).toBeVisible();
    await expect(page.getByText("10%")).toBeVisible();

    await page.getByRole("link", { name: /back to quote/i }).click();
    await expect(page.getByRole("heading", { name: quoteNumber! })).toBeVisible();
    await expect(page.getByText(/^approved$/i)).toBeVisible();
    await expect(page.getByText("10%")).toBeVisible();

    const modifiedDiscount = await getSummaryAmount(page, "Discount");
    const modifiedTotal = await getSummaryAmount(page, "Total");
    expect(modifiedDiscount).not.toEqual(originalDiscount);
    expect(modifiedTotal).not.toEqual(originalTotal);

    await page.getByRole("button", { name: /^generate quote$/i }).click();
    await expect(page.getByText("Requirements complete")).toBeVisible();
    await expect(page.getByText("Inventory resolved")).toBeVisible();
    await expect(page.getByText("Margin within policy")).toBeVisible();
    await expect(page.getByText("Terms accepted")).toBeVisible();
    await expect(page.getByText(/approved/i)).toBeVisible();
  });
});
