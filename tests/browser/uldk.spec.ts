import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixture=readFileSync('tests/fixtures/uldk-parcel.txt','utf8');
test('ULDK identifier imports real response format and preserves service attribution',async({page})=>{
  await page.route('https://uldk.gugik.gov.pl/**',route=>route.fulfill({status:200,contentType:'text/plain',body:fixture}));
  await page.goto('/');await page.locator('[data-workspace-tab=parcel]').click();await page.locator('#parcel-lookup').evaluate((el:HTMLDetailsElement)=>el.open=true);
  await page.locator('#parcel-id').fill('141201_1.0001.6509');await page.locator('#parcel-search').click();
  await expect(page.locator('#p-corners tr')).toHaveCount(7);await expect(page.locator('#parcel-source')).toContainText('GUGiK ULDK');
  await expect(page.locator('#parcel-result')).toHaveText('Plan loaded');await expect(page.locator('.obj')).toHaveCount(2);
});
test('ULDK outages keep the existing plan editable',async({page})=>{
  await page.route('https://uldk.gugik.gov.pl/**',route=>route.fulfill({status:503,body:'Unavailable'}));
  await page.goto('/');await page.locator('[data-workspace-tab=parcel]').click();await page.locator('#parcel-lookup').evaluate((el:HTMLDetailsElement)=>el.open=true);
  await page.locator('#parcel-id').fill('141201_1.0001.6509');await page.locator('#parcel-search').click();
  await expect(page.locator('#parcel-result')).toContainText('Current plan retained');await expect(page.locator('#p-corners tr')).toHaveCount(4);
  await page.locator('[data-workspace-tab=houses]').click();await page.locator('#add-house').click();await expect(page.locator('.obj')).toHaveCount(3);
});
test('late ULDK response cannot replace a project edited during lookup',async({page})=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
  await page.route('https://uldk.gugik.gov.pl/**',async route=>{await gate;await route.fulfill({status:200,body:fixture});});
  await page.goto('/');await page.locator('[data-workspace-tab=parcel]').click();await page.locator('#parcel-lookup').evaluate((el:HTMLDetailsElement)=>el.open=true);
  await page.locator('#parcel-id').fill('141201_1.0001.6509');
  const request=page.waitForRequest(url=>url.url().startsWith('https://uldk.gugik.gov.pl/'));
  await page.locator('#parcel-search').click();await request;await page.locator('[data-workspace-tab=houses]').click();await page.locator('#add-house').click();release();
  await expect(page.locator('#parcel-result')).toContainText('Project changed');await expect(page.locator('#p-corners tr')).toHaveCount(4);await expect(page.locator('.obj')).toHaveCount(3);
});
