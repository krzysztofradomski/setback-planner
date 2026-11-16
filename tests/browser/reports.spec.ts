import { test, expect } from '@playwright/test';
test('SVG export and printable report contain the active configuration and unknown requirements',async({page})=>{
  await page.goto('/');await page.locator('#f-name').fill('My concept house');
  const download=page.waitForEvent('download');await page.locator('#b-svg').click();expect((await download).suggestedFilename()).toBe('setback-plan.svg');
  await page.locator('#b-report').click();await expect(page.locator('#report-dialog')).toBeVisible();
  const report=page.frameLocator('#report-frame');
  await expect(report.getByRole('heading',{name:'My concept house'})).toBeVisible();
  await expect(report.getByRole('heading',{name:'Unverified requirements'})).toBeVisible();
  await expect(report.locator('svg polygon')).toHaveCount(3);
  await expect(report.locator('body')).toContainText('No verified manufacturer price');
  await page.locator('#report-close').click();await expect(page.locator('#report-dialog')).not.toBeVisible();
});
