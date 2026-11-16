import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = readFileSync("tests/fixtures/uldk-parcel.txt", "utf8");
const tile = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
  "base64",
);
async function mapTiles(page: Page) {
  await page.route(
    /https:\/\/(tile.openstreetmap.org|integracja.gugik.gov.pl|mapy.geoportal.gov.pl)\//,
    (r) => r.fulfill({ status: 200, contentType: "image/png", body: tile }),
  );
}
test("first visit leads with parcel search without autosaving an unchosen example", async ({
  page,
}) => {
  let requests = 0;
  await page.route("https://services.gugik.gov.pl/uug/**", (r) => {
    requests++;
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Start with your parcel", exact: true }),
  ).toBeVisible();
  await page.locator("#journey-query").fill("Marki");
  await page.waitForTimeout(400);
  expect(requests).toBe(0);
  expect(
    await page.evaluate(() => localStorage.getItem("setback-planner-v1")),
  ).toBeNull();
  expect(new URL(page.url()).hash).toBe("");
  await page.locator("[data-explore]").click();
  await expect(page.locator(".catalog-card").first()).toBeVisible();
  await expect(page.locator(".journey-welcome")).not.toBeVisible();
});
test("identifier search previews a parcel, confirms it, then leads to house and layout review", async ({
  page,
}) => {
  await mapTiles(page);
  await page.route("https://uldk.gugik.gov.pl/**", (r) =>
    r.fulfill({ status: 200, body: fixture }),
  );
  await page.goto("/");
  await page.locator("[data-mode=id]").click();
  await page.locator("#journey-query").fill("141201_1.0001.6509");
  await page.locator("[data-search]").click();
  await expect(page.locator(".journey-preview")).toContainText(
    "141201_1.0001.6509",
  );
  await expect(page.locator("#p-corners tr")).toHaveCount(4);
  expect(
    await page.evaluate(() => localStorage.getItem("setback-planner-v1")),
  ).toBeNull();
  await page.locator("[data-confirm]").click();
  await expect(page.locator("#p-corners tr")).toHaveCount(7);
  await expect(page.locator("[data-panel=houses]")).toBeVisible();
  await expect(page.locator(".obj")).toHaveCount(0);
  await expect
    .poll(async () => {
      const plot = await page.locator(".plot-fill").boundingBox(),
        canvas = await page.locator(".stage").boundingBox();
      return Math.abs(
        plot!.x + plot!.width / 2 - (canvas!.x + canvas!.width / 2),
      );
    })
    .toBeLessThan(45);
  await page.locator("[data-model=de-75]").click();
  await expect(page.locator(".obj")).toHaveCount(1);
  await expect(page.locator("#f-w")).toHaveValue("11.76");
  await page.locator(".journey-next").click();
  await expect(page.locator("#review-layout")).toBeVisible();
  await expect(page.locator("#review-layout")).toContainText(
    "Planning rules and site conditions still require verification",
  );
});
test("address ambiguity offers candidates and requires a map boundary selection", async ({
  page,
}) => {
  await mapTiles(page);
  await page.route("https://services.gugik.gov.pl/uug/**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        type: "city",
        "found objects": 2,
        results: {
          "1": {
            city: "Marki",
            voivodeship: "mazowieckie",
            county: "wołomiński",
            commune: "Marki",
            x: "644234.29",
            y: "499514.03",
          },
          "2": {
            city: "Marki",
            voivodeship: "łódzkie",
            county: "bełchatowski",
            commune: "Drużbice",
            x: "523436",
            y: "398347",
          },
        },
      }),
    }),
  );
  let lookups = 0;
  await page.route("https://uldk.gugik.gov.pl/**", (r) => {
    lookups++;
    return r.fulfill({
      status: 200,
      body: fixture.replace("\nSRID=", "\n141201_1.0001.6509|SRID="),
    });
  });
  await page.goto("/");
  await page.locator("#journey-query").fill("Marki");
  await page.locator("[data-search]").click();
  await expect(page.locator(".journey-location")).toHaveCount(2);
  await expect(page.locator(".journey-location").first()).toContainText(
    "wołomiński",
  );
  await page.locator(".journey-location").first().click();
  await expect(page.locator(".journey-status")).toContainText(
    "not a confirmed parcel",
  );
  expect(lookups).toBe(0);
  await expect(page.locator(".maplibregl-marker")).toBeVisible();
  await page
    .locator("#parcel-map canvas")
    .click({ position: { x: 200, y: 220 } });
  await expect(page.locator("[data-confirm]")).toBeVisible();
  await expect(page.locator("#p-corners tr")).toHaveCount(4);
});
test("short parcel numbers and unavailable address services offer recovery without changing the plan", async ({
  page,
}) => {
  let calls = 0;
  await page.route("https://services.gugik.gov.pl/uug/**", (r) => {
    calls++;
    return r.fulfill({ status: 503, body: "Unavailable" });
  });
  await page.goto("/");
  await page.locator("#journey-query").fill("232/2");
  await page.locator("[data-search]").click();
  await expect(page.locator(".journey-status")).toContainText("not unique");
  expect(calls).toBe(0);
  await page.locator("#journey-query").fill("Marki, Andersa 1");
  await page.locator("[data-search]").click();
  await expect(page.locator(".journey-status")).toContainText(
    "Try again or choose on the map",
  );
  await expect(page.locator("[data-search]")).toBeEnabled();
  await expect(page.locator("[data-explore]")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("setback-planner-v1")),
  ).toBeNull();
});
test("a late lookup cannot replace a project changed while searching", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("setback-entry-dismissed", "1"),
  );
  await mapTiles(page);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("https://uldk.gugik.gov.pl/**", async (r) => {
    await gate;
    await r.fulfill({ status: 200, body: fixture });
  });
  await page.goto("/");
  await page.locator("[data-workspace-tab=parcel]").click();
  await page.locator("[data-mode=id]").click();
  await page.locator("#journey-query").fill("141201_1.0001.6509");
  const request = page.waitForRequest((r) =>
    r.url().startsWith("https://uldk.gugik.gov.pl"),
  );
  await page.locator("[data-search]").click();
  await request;
  await page.locator("#f-name").fill("Keep my edit");
  release();
  await expect(page.locator(".journey-status")).toContainText(
    "project changed",
  );
  await expect(page.locator("[data-confirm]")).toHaveCount(0);
  await expect(page.locator("#f-name")).toHaveValue("Keep my edit");
  await expect(page.locator("#p-corners tr")).toHaveCount(4);
});
test("map preview can be corrected by clicking a neighboring parcel before confirmation", async ({
  page,
}) => {
  await mapTiles(page);
  let n = 0;
  await page.route("https://uldk.gugik.gov.pl/**", (r) =>
    r.fulfill({
      status: 200,
      body: fixture.replace("\nSRID=", `\n141201_1.0001.${++n}|SRID=`),
    }),
  );
  await page.goto("/");
  await page.locator("[data-pick]").click();
  await expect(page.locator("#parcel-map")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .locator("#parcel-map canvas")
    .click({ position: { x: 210, y: 240 } });
  await expect(page.locator(".journey-preview")).toContainText(
    "141201_1.0001.1",
  );
  await page
    .locator("#parcel-map canvas")
    .click({ position: { x: 230, y: 260 } });
  await expect(page.locator(".journey-preview")).toContainText(
    "141201_1.0001.2",
  );
  await page.locator("[data-confirm]").click();
  await expect(page.locator("#parcel-source")).toContainText("141201_1.0001.2");
});
test("mobile introduction and example exit stay inside the screen in Polish", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("setback-planner-lang", "pl"));await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Zacznij od swojej działki",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("[data-gps]")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("[data-explore]").click();
  await expect(page.locator(".catalog-card").first()).toBeVisible();
});
test("location permission is requested only by an explicit click and denial leaves search usable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          _success: PositionCallback,
          fail: PositionErrorCallback,
        ) => {
          document.documentElement.dataset.gpsCalls = "1";
          fail({ code: 1, message: "Denied" } as GeolocationPositionError);
        },
      },
    }),
  );
  await page.goto("/");
  expect(await page.locator("html").getAttribute("data-gps-calls")).toBeNull();
  await expect(page.locator("#b-link")).toBeDisabled();
  await page.locator("[data-gps]").click();
  await expect(page.locator(".journey-status")).toContainText(
    "Location is unavailable",
  );
  await expect(page.locator("[data-search]")).toBeEnabled();
  await expect(page.locator("html")).toHaveAttribute("data-gps-calls", "1");
});
test("confirmation is disabled if the user edits the project after the preview arrived", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("setback-entry-dismissed", "1"),
  );
  await mapTiles(page);
  await page.route("https://uldk.gugik.gov.pl/**", (r) =>
    r.fulfill({ status: 200, body: fixture }),
  );
  await page.goto("/");
  await page.locator("[data-workspace-tab=parcel]").click();
  await page.locator("[data-mode=id]").click();
  await page.locator("#journey-query").fill("141201_1.0001.6509");
  await page.locator("[data-search]").click();
  await expect(page.locator("[data-confirm]")).toBeEnabled();
  await page.locator("[data-workspace-tab=houses]").click();
  await page.locator("#f-name").fill("Changed after preview");
  await page.locator("[data-workspace-tab=parcel]").click();
  await expect(page.locator("[data-confirm]")).toBeDisabled();
  await expect(page.locator("#p-corners tr")).toHaveCount(4);
});
test("phone confirmation action stays visible and the inspector keeps the review next step", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mapTiles(page);
  await page.route("https://uldk.gugik.gov.pl/**", (r) =>
    r.fulfill({ status: 200, body: fixture }),
  );
  await page.goto("/");
  await page.locator("[data-mode=id]").click();
  await page.locator("#journey-query").fill("141201_1.0001.6509");
  await page.locator("[data-search]").click();
  await expect(page.locator("[data-confirm]")).toBeVisible();
  const button = await page.locator("[data-confirm]").boundingBox();
  expect(button!.y + button!.height).toBeLessThan(780);
  await expect(page.locator("#journey-query")).not.toBeVisible();
  await page.locator("[data-confirm]").click();
  await page.locator("[data-model=de-75]").click();
  await expect(page.locator(".journey-inspector-next")).toBeVisible();
  await page.locator(".journey-inspector-next").click();
  await expect(page.locator("#review-layout")).toContainText(
    "Review your layout",
  );
});
test("Project navigation always initializes the layout review", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("[data-explore]").click();
  await page.locator("[data-workspace-tab=project]").click();
  await expect(page.locator("#review-layout")).toContainText(
    "Building footprints",
  );
  await expect(page.locator("#review-report")).toBeVisible();
});
test("saved projects and shared scenes bypass first-visit setup without changing their geometry", async ({
  page,
}) => {
  const saved = {
    plot: [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 40 },
      { x: 0, y: 40 },
    ],
    items: [
      {
        id: "saved",
        type: "house",
        name: "Saved home",
        x: 15,
        y: 20,
        w: 10,
        d: 8,
        rot: 25,
      },
    ],
  };
  await page.addInitScript(
    (value) =>
      localStorage.setItem("setback-planner-v1", JSON.stringify(value)),
    saved,
  );
  await page.goto("/");
  await expect(page.locator(".journey-welcome")).not.toBeVisible();
  await expect(page.locator("#f-name")).toHaveValue("Saved home");
  await expect(page.locator("#f-rot")).toHaveValue("25");
  const shared = {
    ...saved,
    items: [{ ...saved.items[0], name: "Shared home", w: 14 }],
  };
  await page.goto(
    "/#p=" + Buffer.from(JSON.stringify(shared)).toString("base64url"),
  );
  await expect(page.locator(".journey-welcome")).not.toBeVisible();
  await expect(page.locator("#f-name")).toHaveValue("Shared home");
  await expect(page.locator("#f-w")).toHaveValue("14");
});
test("leaving the wide introduction refits the example into the narrower planning canvas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.locator("[data-explore]").click();
  const canvas = await page.locator(".stage").boundingBox(),
    plot = await page.locator(".plot-fill").boundingBox();
  expect(plot!.x).toBeGreaterThanOrEqual(canvas!.x);
  expect(plot!.x + plot!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width);
  expect(
    Math.abs(plot!.x + plot!.width / 2 - (canvas!.x + canvas!.width / 2)),
  ).toBeLessThan(45);
});
