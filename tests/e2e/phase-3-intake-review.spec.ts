import { expect, test } from "@playwright/test";

test.describe("phase 3 intake and review workspace", () => {
  test("submits Atlas intake, reviews and corrects fields, continues configuration, and persists the draft", async ({ page, request }) => {
    const resetResponse = await request.post("/api/demo/reset");
    expect(resetResponse.ok(), await resetResponse.text()).toBeTruthy();

    await page.goto("/quotes/new");

    await expect(page.getByRole("heading", { name: /intake a customer request/i })).toBeVisible();
    await expect(page.getByText("Customer Request Intake")).toBeVisible();
    await expect(page.getByText("Seed example for reliable demos")).toBeVisible();
    await expect(page.getByLabel("Customer request")).toBeVisible();
    await expect(page.getByText("Attachments (optional)")).toBeVisible();
    await expect(page.getByText(/V1 visual \/ limited implementation/i)).toBeVisible();
    await expect(page.getByText("Recent Activity")).toBeVisible();
    await expect(page.getByText("Intake Checklist")).toBeVisible();
    await expect(page.getByText("SLA Information")).toBeVisible();
    await expect(page.getByText("Start preview")).toBeVisible();
    await expect(page.getByText("Due preview")).toBeVisible();
    await expect(page.getByRole("button", { name: /extract and build quote/i })).toBeVisible();

    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Atlas compressor request" }).click();
    await expect(page.getByLabel("Customer request")).toContainText("Installation is ambiguous");
    await expect(page.getByLabel("Customer name")).toHaveValue("Atlas Manufacturing");
    await expect(page.getByLabel("Customer email")).toHaveValue("procurement@atlas.example");
    await expect(page.getByLabel("Company domain")).toHaveValue("atlas.example");
    await expect(page.getByLabel("Opportunity")).toHaveValue("Dallas Paint Line Expansion");
    await expect(page.getByLabel("Valid until")).toHaveValue("2026-09-15");

    await page.getByRole("button", { name: /extract and build quote/i }).click();
    await expect(page).toHaveURL(/\/quotes\/[^/]+\/needs-information$/, { timeout: 30_000 });

    await expect(page.getByText("Original customer request")).toBeVisible();
    await expect(page.getByText(/Atlas Manufacturing is requesting a quote/i)).toBeVisible();
    await expect(page.getByText("Information requiring attention")).toBeVisible();
    await expect(page.getByText(/installation requirement/i).first()).toBeVisible();
    await expect(page.getByText("Product candidate selection")).toBeVisible();
    await expect(page.getByText(/AX-200/i).first()).toBeVisible();

    await page.getByRole("button", { name: /^save draft$/i }).click();
    await expect(page.getByRole("button", { name: /^save draft$/i })).toBeEnabled({ timeout: 15_000 });

    await page.getByRole("button", { name: /save and continue to configuration/i }).click();

    await page.reload();
    await expect(page.getByText("configuring")).toBeVisible();
    await expect(page.getByText("Quote Configuration")).toBeVisible();
  });
});
