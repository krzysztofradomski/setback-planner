import { test, expect } from '@playwright/test';
const tile=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64');
test('map loads attributed providers, layers and georeferenced overlay without altering the plan',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.route(/https:\/\/(tile.openstreetmap.org|mapy.geoportal.gov.pl|integracja.gugik.gov.pl)\//,route=>route.fulfill({status:200,contentType:'image/png',body:tile}));
  await page.goto('/');await page.locator('#view-map').click();
  await expect(page.locator('#parcel-map canvas')).toBeVisible();
  await expect(page.locator('#parcel-map')).toHaveAttribute('data-ready','true');
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenStreetMap');
  await page.locator('#map-base').selectOption('ortho');await page.locator('#map-cadastre').check();
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('GUGiK');
  await page.locator('#view-2d').click();await expect(page.locator('#sheet')).toBeVisible();await expect(page.locator('.obj')).toHaveCount(2);
  expect(errors).toEqual([]);
});
test('map layer failures leave a visible fallback and a working editor',async({page})=>{
  await page.route('https://tile.openstreetmap.org/**',route=>route.abort('failed'));
  await page.goto('/');await page.locator('#view-map').click();await expect(page.locator('#map-status')).toContainText('unavailable');
  await page.locator('#view-2d').click();await page.locator('#add-house').click();await expect(page.locator('.obj')).toHaveCount(3);
});
