import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("dashboard workflow actions", () => {
  it("removes old quote queue labels from workflow source files", () => {
    const workflowSources = [
      "app/quotes/[quoteId]/approval-pending/page.tsx",
      "app/quotes/[quoteId]/sent/page.tsx",
      "components/quotes/review-information-form.tsx",
      "components/quotes/needs-information-form.tsx",
      "components/quotes/quote-workspace-actions.tsx",
    ].map(read).join("\n");

    expect(workflowSources).toContain("Dashboard");
    expect(workflowSources).not.toContain("Back to quote queue");
    expect(workflowSources).not.toContain("Back to Queue");
    expect(workflowSources).not.toContain("Back to Queue Quote");
  });

  it("supports save, navigation, and submit-form dashboard modes", () => {
    const source = read("components/app-shell/dashboard-button.tsx");

    expect(source).toContain('mode: "navigate"');
    expect(source).toContain('mode: "save"');
    expect(source).toContain('mode: "submit-form"');
    expect(source).toContain('router.push("/quotes")');
    expect(source).toContain('role="alert"');
    expect(source).toContain('value="dashboard"');
  });

  it("persists new quote intake drafts only in browser storage", () => {
    const source = read("components/quotes/quote-intake-form.tsx");

    expect(source).toContain('intakeDraftStorageKey = "iquote:new-intake-draft:v1"');
    expect(source).toContain("window.sessionStorage.setItem");
    expect(source).toContain("window.sessionStorage.removeItem");
    expect(source).toContain("Unsaved intake draft restored from this device.");
    expect(source).toContain("Intake draft saved on this device.");
  });

  it("keeps dashboard draft intents separate from workflow advancement", () => {
    const reviewAction = read("app/quotes/[quoteId]/review/actions.ts");
    const needsAction = read("app/quotes/[quoteId]/needs-information/actions.ts");
    const reviewSchema = read("lib/rules/review-field-registry.ts");
    const needsSchema = read("lib/rules/missing-information-rules.ts");
    const configureActions = read("components/quotes/quote-workspace-actions.tsx");

    expect(reviewAction).toContain('data.intent === "continue"');
    expect(reviewSchema).toContain('intent: z.enum(["continue", "draft", "dashboard"])');
    expect(needsAction).toContain('data.intent === "continue"');
    expect(needsSchema).toContain('intent: z.enum(["continue", "draft", "dashboard"])');
    expect(configureActions).toContain('run("dashboard"');
    expect(configureActions).toContain('router.push("/quotes")');
    expect(configureActions).not.toContain('finally {\n        router.push("/quotes");');
  });
});
