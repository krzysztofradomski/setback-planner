import { test,expect } from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.route('**/__showroom_test*',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>Planner fixture</h1><div id="showroom"></div><output id="scene"></output><script type="module">
    import {mountShowroom} from '/showroom.ts';import {exampleScene} from '/core/showroom.ts';import {plainShare} from '/core/scene.ts';
    let scene=exampleScene();scene.items[0].name='Ordinary project';let active=false;
    const render=()=>document.querySelector('#scene').textContent=scene.items[0].name;
    window.showroom=mountShowroom({container:document.querySelector('#showroom'),getScene:()=>scene,applyScene:value=>{scene=value;render();},shareUrl:()=>location.origin+'/?email=private'+plainShare(scene),onActiveChange:value=>{active=value;document.body.dataset.active=String(active);},onSessionReset:()=>{document.body.dataset.resets=String(Number(document.body.dataset.resets||0)+1);},idleSeconds:30,warningSeconds:10});render();
    </script></body></html>`}));
  await page.goto('/__showroom_test?utm_source=fair');
  await expect(page.getByText('Showroom / Tryb pokazowy')).toBeVisible();
});

test('showroom demo, QR transfer and exit preserve ordinary projects',async({page})=>{
  await page.evaluate(()=>{localStorage.setItem('ordinary-project','keep');localStorage.setItem('setback-planner:kiosk:contact','visitor');});
  await page.getByText('Showroom / Tryb pokazowy').click();
  await page.getByLabel('Profile name').fill('Example showroom');
  await page.getByRole('button',{name:'Start presentation / Rozpocznij pokaz'}).click();
  await expect(page.getByRole('heading',{name:'Imagine your place.'})).toBeVisible();
  await page.getByRole('button',{name:'Touch to begin / Dotknij, aby rozpocząć'}).click();
  await page.getByRole('button',{name:'Guided demo'}).click();
  await expect(page.getByText('1 / 3 — Start with a parcel', {exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Take project to phone'}).click();
  await expect(page.getByText('Scan to continue planning on your phone.')).toBeVisible();
  const href=await page.getByRole('link',{name:'Open project link'}).getAttribute('href');
  expect(href).toContain('#p=');expect(href).not.toContain('email');expect(href).not.toContain('utm_');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'New visitor / Reset'}).click();
  expect(await page.evaluate(()=>localStorage.getItem('ordinary-project'))).toBe('keep');
  expect(await page.evaluate(()=>localStorage.getItem('setback-planner:kiosk:contact'))).toBeNull();
  await page.getByRole('button',{name:'Touch to begin / Dotknij, aby rozpocząć'}).click();
  await page.getByRole('button',{name:'Exit presentation'}).click();
  await expect(page.locator('#scene')).toHaveText('Ordinary project');
  await expect(page.locator('body')).toHaveAttribute('data-active','false');
});

test('inactivity warns, allows continuation and resets to attract screen',async({page})=>{
  await page.clock.install();
  await page.getByText('Showroom / Tryb pokazowy').click();
  await page.getByRole('button',{name:'Start presentation / Rozpocznij pokaz'}).click();
  await page.getByRole('button',{name:'Touch to begin / Dotknij, aby rozpocząć'}).click();
  await page.clock.fastForward(21_000);
  await expect(page.getByRole('heading',{name:'Still planning?'})).toBeVisible();
  await page.getByRole('button',{name:'Keep planning / Kontynuuj'}).click();
  await expect(page.getByRole('heading',{name:'Still planning?'})).not.toBeVisible();
  await page.clock.fastForward(21_000);
  await expect(page.getByRole('heading',{name:'Still planning?'})).toBeVisible();
  await page.clock.fastForward(10_000);
  await expect(page.getByRole('heading',{name:'Imagine your place.'})).toBeVisible();
});

test('keyboard can leave attract screen and hostile attribution is discarded',async({page})=>{
  await page.evaluate(()=>sessionStorage.clear());
  await page.goto('/__showroom_test?utm_source=person%40example.com&campaign=https%3A%2F%2Fevil.test&event=Trade%20Fair');
  const attribution=await page.evaluate('window.showroom.getAttribution()');
  expect(attribution.utm_source).toBeUndefined();expect(attribution.campaign).toBeUndefined();expect(attribution.event).toBe('Trade Fair');
  await page.getByText('Showroom / Tryb pokazowy').click();
  await page.getByRole('button',{name:'Start presentation / Rozpocznij pokaz'}).click();
  await expect(page.getByRole('button',{name:'Touch to begin / Dotknij, aby rozpocząć'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Plan 2D'})).toBeFocused();
  await page.getByRole('button',{name:'Exit presentation'}).click();
});
