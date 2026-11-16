import { test, expect } from './editor-fixture';
test('3D supports camera presets, live materials, screenshot and 2D return',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if((msg.type()==='error'||msg.type()==='warning')&&!/GL Driver Message.*GPU stall due to ReadPixels/.test(msg.text()))errors.push(msg.text());});
  await page.goto('/');
  await page.locator('#view-3d').click();
  await expect(page.locator('#viewer canvas')).toBeVisible();await expect(page.locator('#sheet')).not.toBeVisible();
  await page.locator('#view-top').click();
  await page.locator('#view-axon').click();
  await page.locator('.viewer-more summary').click();await page.locator('#view-low').check();
  await page.locator('#material-options').evaluate((el:HTMLDetailsElement)=>el.open=true);
  await page.locator('#f-facade').selectOption('brick-red');
  await page.locator('#viewer').screenshot({path:'test-results/viewer.png'});
  await page.locator('.viewer-more').evaluate((el:HTMLDetailsElement)=>el.open=true);const download=page.waitForEvent('download');await page.locator('#view-capture').click();
  expect((await download).suggestedFilename()).toBe('setback-3d.png');
  await page.locator('#view-2d').click();
  await expect(page.locator('#sheet')).toBeVisible();
  await expect(page.locator('.obj')).toHaveCount(2);
  expect(errors).toEqual([]);
});
test('WebGL unavailability preserves the 2D planner',async({page})=>{
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){
      if(type==='webgl2')return null;
      return original.apply(this,[type,...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.goto('/');await page.locator('#view-3d').click();
  await expect(page.locator('#toast')).toContainText('3D is unavailable');
  await expect(page.locator('#sheet')).toBeVisible();
  await page.locator('#add-house').click();await expect(page.locator('.obj')).toHaveCount(3);
});
test('mobile 3D stays within the viewport and repeated edits release GPU resources',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.locator('#view-3d').click();await expect(page.locator('#viewer canvas')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const memory=await page.evaluate(async()=>{
    const viewerPath='/viewer/viewer.ts',scenePath='/core/scene.ts';
    const {createViewer}=await import(viewerPath),{parseScene}=await import(scenePath);
    const container=document.createElement('div');container.style.cssText='width:320px;height:240px';document.body.append(container);
    const viewer=createViewer(container,()=>{});
    const scene=parseScene({plot:[{x:0,y:0},{x:30,y:0},{x:30,y:40},{x:0,y:40}],items:[{id:'test',type:'house',name:'Test',x:15,y:20,w:10,d:8,appearance:{facade:'brick-red'}}]});
    viewer.update(scene);const first=viewer.memory();
    for(let i=0;i<20;i++){scene.items[0].x=15+i/20;viewer.update(scene);}
    const last=viewer.memory();viewer.dispose();container.remove();return {first,last};
  });
  expect(memory.last.geometries).toBeLessThanOrEqual(memory.first.geometries+1);
  expect(memory.last.textures).toBeLessThanOrEqual(memory.first.textures+1);
});
