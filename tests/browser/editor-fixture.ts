import { test as base, expect } from "@playwright/test";
/** Existing editor regressions start after the visitor chose the example workspace.
 * First-visit search/confirmation is exercised separately in parcel-journey.spec.ts. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() =>
      sessionStorage.setItem("setback-entry-dismissed", "1"),
    );
    await use(page);
  },
});
export { expect };
