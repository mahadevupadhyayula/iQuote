import { expect, test } from "@playwright/test";

const requestText = [
  "Atlas Manufacturing needs a customer quote for 4 AX-200 compressors.",
  "Ship the order to Dallas, Texas by September 15, 2026.",
  "Requested discount must be 8% or lower.",
  "Please split fulfillment from Chicago and Houston if one warehouse cannot cover the full order.",
].join("\n");

test.describe("scenario A: straight-through Atlas Manufacturing quote", () => {
  test("resets demo data, resolves fulfillment, passes policy, generates the quote, and exposes the PDF", async ({ page, request }) => {
    const resetResponse = await request.post("/api/demo/reset");
    expect(resetResponse.ok(), await resetResponse.text()).toBeTruthy();

    await page.goto("/quotes/new");
    await page.getByLabel("Customer name").fill("Atlas Manufacturing");
    await page.getByLabel("Customer email").fill("buyer@atlas.example");
    await page.getByLabel("Company domain").fill("atlas.example");
    await page.getByLabel("Opportunity").fill("Dallas compressor replenishment");
    await page.getByLabel("Currency").fill("USD");
    await page.getByLabel("Valid until").fill("2026-09-15");
    await page.getByLabel("Request text").fill(requestText);

    await page.getByRole("button", { name: /extract and build quote/i }).click();

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
    await expect(page.getByText("4").first()).toBeVisible();
    await expect(page.getByText("Dallas, TX")).toBeVisible();
    await expect(page.getByText("Sep 15, 2026")).toBeVisible();
    await expect(page.getByText("8%")).toBeVisible();

    await page.getByRole("button", { name: /use recommended/i }).first().click();
    await expect(page.getByText("Inventory has a saved recommendation")).toBeVisible();
    await expect(page.getByText(/split fulfillment/i)).toBeVisible();
    await expect(page.getByText(/Chicago/i)).toBeVisible();
    await expect(page.getByText(/Houston/i)).toBeVisible();

    await page.getByRole("button", { name: /^continue$/i }).click();
    await expect(page.getByText("Requirements complete")).toBeVisible();
    await expect(page.getByText("Inventory resolved")).toBeVisible();
    await expect(page.getByText("Margin within policy")).toBeVisible();
    await expect(page.getByText("Terms accepted")).toBeVisible();
    await expect(page.getByText(/approved/i)).toBeVisible();

    const quoteId = new URL(page.url()).pathname.split("/")[2];
    const pdfResponse = await request.get(`/api/quotes/${quoteId}/pdf`);
    expect(pdfResponse.ok(), await pdfResponse.text()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toMatch(/application\/pdf/i);
    expect(pdfResponse.headers()["content-disposition"]).toMatch(/filename=.*\.pdf/i);

    await page.getByLabel("Recipient email").fill("buyer@atlas.example");
    await page.getByLabel("Optional message").fill("Demo quote delivery");
    await page.getByRole("button", { name: /^send quote$/i }).click();
    await expect(page).toHaveURL(new RegExp(`/quotes/${quoteId}/sent$`));
    await expect(page.getByText("Mock delivery status")).toBeVisible();
  });
});
