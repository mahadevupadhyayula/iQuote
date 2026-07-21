import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const clearDemoQuoteActivity = vi.fn(async () => ({
  quotesDeleted: 1,
  quoteItemsDeleted: 2,
  approvalsDeleted: 0,
  workflowEventsDeleted: 3,
}));

vi.mock("@/lib/services/demo-reset-service", () => ({ clearDemoQuoteActivity }));

describe("POST /api/demo/clear-activity", () => {
  it("returns 404 when disabled", async () => {
    process.env.ENABLE_DEMO_ACTIVITY_RESET = "false";
    const { POST } = await import("@/app/api/demo/clear-activity/route");

    const response = await POST();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Demo activity reset is disabled." });
    expect(clearDemoQuoteActivity).not.toHaveBeenCalled();
  });

  it("returns counts when enabled", async () => {
    process.env.ENABLE_DEMO_ACTIVITY_RESET = "true";
    const { POST } = await import("@/app/api/demo/clear-activity/route");

    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      counts: {
        quotesDeleted: 1,
        quoteItemsDeleted: 2,
        approvalsDeleted: 0,
        workflowEventsDeleted: 3,
      },
    });
  });
});
