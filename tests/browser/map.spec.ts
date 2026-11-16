import { test, expect } from './editor-fixture';
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
  await page.goto('/');await page.locator('#view-map').click();await expect(page.locator('#map-status')).toContainText('could not load');
  await page.locator('#view-2d').click();await page.locator('[data-workspace-tab=houses]').click();await page.locator('#add-house').click();await expect(page.locator('.obj')).toHaveCount(3);
});
test('map selection is explicit and imports the clicked parcel identity',async({page})=>{
  await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({status:200,contentType:'image/png',body:tile}));
  const {readFileSync}=await import('node:fs');const fixture=readFileSync('tests/fixtures/uldk-parcel.txt','utf8');
  await page.route('https://uldk.gugik.gov.pl/**',route=>{
    expect(new URL(route.request().url()).searchParams.get('request')).toBe('GetParcelByXY');
    return route.fulfill({status:200,body:fixture.replace('\nSRID=','\n141201_1.0001.6509|SRID=')});
  });
  await page.goto('/');await page.locator('#view-map').click();await expect(page.locator('#parcel-map')).toHaveAttribute('data-ready','true');
  await page.locator('#parcel-map canvas').click({position:{x:250,y:250}});await expect(page.locator('#p-corners tr')).toHaveCount(4);
  await page.locator('#map-pick').click();await page.locator('#parcel-map canvas').click({position:{x:250,y:250}});
  await expect(page.locator('[data-confirm]')).toBeVisible();await page.locator('[data-confirm]').click();await expect(page.locator('#p-corners tr')).toHaveCount(7);await expect(page.locator('#parcel-source')).toContainText('141201_1.0001.6509');
  await expect(page.locator('#map-pick')).toHaveAttribute('aria-pressed','false');
});
test('a flood overlay selected before map initialization is applied to official tile requests',async({page})=>{
 let floodRequests=0;await page.route('https://mapy.geoportal.gov.pl/**',r=>r.fulfill({status:200,contentType:'image/png',body:tile}));
 await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({status:200,contentType:'image/png',body:tile}));
 await page.route('https://wody.isok.gov.pl/**',r=>{expect(new URL(r.request().url()).searchParams.get('LAYERS')).toContain('NZ.Fluvial');floodRequests++;return r.fulfill({status:200,contentType:'image/png',body:tile});});
 await page.goto('/');await page.locator('[data-workspace-tab=parcel]').click();await page.locator('#map-flood').check();await page.locator('#view-map').click();await expect(page.locator('#parcel-map')).toHaveAttribute('data-ready','true');await page.locator('#map-base').selectOption('ortho');
 await expect.poll(()=>floodRequests).toBeGreaterThan(0);await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('ISOK');
});
