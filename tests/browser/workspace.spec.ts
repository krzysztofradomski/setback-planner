import { test, expect } from "@playwright/test";
test("catalog photos, plan preview and sourced building placement work through the workspace", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".catalog-card")).toHaveCount(4);
  for (const image of await page.locator(".catalog-card>img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (i: HTMLImageElement) => i.complete && i.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  await page
    .locator(".catalog-card")
    .first()
    .getByRole("button", { name: "Plan ↗" })
    .click();
  await expect(page.locator(".catalog-plan-dialog")).toBeVisible();
  await expect(page.locator(".catalog-plan-dialog img")).toHaveAttribute(
    "src",
    /de-75-plan/,
  );
  await page.getByRole("button", { name: "Close plan" }).click();
  await page.locator('[data-model="de-105"]').click();
  await expect(page.locator(".obj")).toHaveCount(3);
  await expect(page.locator("#f-w")).toHaveValue("13.1");
  await expect(page.locator("#f-d")).toHaveValue("9.98");
  await page.locator("#b-link").click();
  await page.goto(await page.evaluate(() => navigator.clipboard.readText()));
  await page.locator("#objs .obj").last().click();
  await expect(page.locator("#f-w")).toHaveValue("13.1");
  await expect(page.locator("#f-name")).toHaveValue("Udana Budowa DE 105");
  expect(errors).toEqual([]);
});
test("workspace navigation separates parcel sources and garden settings from selected properties", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("[data-panel=houses]")).toBeVisible();
  await expect(page.locator("[data-panel=parcel]")).not.toBeVisible();
  await page.locator("[data-workspace-tab=parcel]").click();
  await expect(page.locator("#parcel-lookup")).toBeVisible();
  await page.locator("#source-directory>summary").click();
  await expect(page.locator("#source-directory")).toContainText(
    "Official registries",
  );
  await expect(page.locator("#source-directory")).toContainText("ISOK");
  await page.locator("[data-workspace-tab=garden]").click();
  await expect(page.locator("#garden-kind")).toBeVisible();
  await expect(page.locator("#parcel-lookup")).not.toBeVisible();
  await page.locator("[data-workspace-tab=project]").click();
  await expect(page.locator("#b-download")).toBeVisible();
  await expect(page.locator(".inspector")).toBeVisible();
});
test("mobile library can be dismissed and inspector can edit a placed catalog building", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("[data-model=de-75]").click();
  await expect(page.locator(".inspector")).toBeVisible();
  await expect(page.locator("#f-w")).toHaveValue("11.76");
  await page.locator("#f-name").fill("My DE 75");
  await page.locator("[data-workspace-tab=houses]").click();
  await expect(page.locator(".rail")).toBeVisible();
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await expect(page.locator(".rail")).not.toBeVisible();
  const plot = await page.locator(".plot-fill").boundingBox();
  expect(plot!.height).toBeGreaterThan(200);
  expect(plot!.y).toBeGreaterThan(60);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("[data-workspace-tab=selected]").click();
  await expect(page.locator("#f-name")).toHaveValue("My DE 75");
});

test("window editor adds conceptual openings without requiring JSON and rejects an oversized opening", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#opening-editor>summary").click();
  await page.locator("#opening-add").click();
  await expect(page.locator(".opening-list button")).toHaveCount(1);
  await page.locator("#opening-width").fill("100");
  await page.locator("#opening-add").click();
  await expect(page.locator("#opening-error")).toContainText("fit inside");
  await expect(page.locator(".opening-list button")).toHaveCount(1);
  await page.locator(".opening-list button").click();
  await expect(page.locator(".opening-list button")).toHaveCount(0);
});

test("tablet dismissal expands the map canvas and plan previews provide zoom and an accessible name", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  const before = await page.locator(".stage").boundingBox();
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  const after = await page.locator(".stage").boundingBox();
  expect(after!.width).toBeGreaterThan(before!.width + 200);
  await page.locator("[data-workspace-tab=houses]").click();
  await page
    .locator(".catalog-card")
    .first()
    .getByRole("button", { name: "Plan ↗" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "DE 75", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ Zoom plan", exact: true }).click();
  expect(
    await page
      .locator(".plan-image-wrap img")
      .evaluate((e) => e.getBoundingClientRect().width),
  ).toBeGreaterThan(1000);
  await expect(
    page.getByRole("link", { name: "Open full-size ↗", exact: true }),
  ).toHaveAttribute("href", /de-75-plan/);
});
