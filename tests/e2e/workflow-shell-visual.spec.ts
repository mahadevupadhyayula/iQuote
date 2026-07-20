import { expect, test } from '@playwright/test';

const workflowStates = [
  { stage: 'intake', title: 'Intake customer request' },
  { stage: 'review', title: 'Review quote configuration' },
  { stage: 'resolve-exceptions', title: 'Resolve quote exceptions' },
  { stage: 'generate-quote', title: 'Generate customer quote' },
] as const;

// Visual threshold: allow a small 1% pixel-difference budget for font/rendering
// antialiasing while still catching meaningful layout regressions.
const screenshotComparison = { maxDiffPixelRatio: 0.01 };

test.describe('workflow shell visual fixtures', () => {
  test.use({ viewport: { width: 1440, height: 1080 } });

  for (const { stage, title } of workflowStates) {
    test(`${stage} fixture matches screenshot`, async ({ page }) => {
      await page.goto(`/workflow-shell/fixtures/${stage}`);
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
      await expect(page).toHaveScreenshot(`workflow-shell-${stage}.png`, {
        fullPage: true,
        ...screenshotComparison,
      });
    });
  }
});
