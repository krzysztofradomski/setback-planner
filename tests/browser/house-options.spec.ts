import {test,expect} from './editor-fixture';
import {test as firstVisit} from '@playwright/test';
test('house options update attached footprints and persist installation choices',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.locator('[data-model="de-105"]').click();
 await expect(page.locator('#house-options')).toBeVisible();
 const before=await page.locator('#objs .obj').count();
 await page.locator('#house-parking').selectOption('none');await expect(page.locator('#objs .obj')).toHaveCount(before-1);
 await page.locator('#house-parking').selectOption('garage');await expect(page.locator('#objs .obj')).toHaveCount(before);
 await page.locator('#house-parking').selectOption('carport');await expect(page.locator('#objs .obj')).toHaveCount(before);
 for(const key of ['fireplace','recuperation','heatPump'])await page.locator(`[data-house-option="${key}"]`).check();
 await page.locator('[data-house-option="solarPanels"]').uncheck();
 await page.locator('#view-3d').click();await expect(page.locator('#viewer canvas')).toBeVisible();
 await page.locator('#view-top').click();await page.locator('#viewer').screenshot({path:'test-results/house-options-cutaway.png'});await page.locator('#view-axon').click();
 await page.reload();await page.locator('#objs .obj').filter({hasText:'Udana Budowa DE 105'}).click();
 await expect(page.locator('#house-parking')).toHaveValue('carport');
 for(const key of ['fireplace','recuperation','heatPump'])await expect(page.locator(`[data-house-option="${key}"]`)).toBeChecked();
 await expect(page.locator('[data-house-option="solarPanels"]')).not.toBeChecked();
 await page.locator('#view-3d').click();await page.locator('#viewer').screenshot({path:'test-results/house-options.png'});
 const geometry=await page.evaluate(async()=>{
  const catalogsPath='/core/catalogs.ts',placementPath='/catalogs/placement.ts',modelPath='/viewer/model.ts';
  const {loadCatalog}=await import(catalogsPath),{createCatalogItem}=await import(placementPath),{buildBuilding,disposeObject}=await import(modelPath),catalog=await loadCatalog('udana-budowa');
  const result=[];
  for(const model of catalog.models){
   const house=createCatalogItem(catalog,model.id,{id:'verify',x:0,y:0});
   for(const season of ['summer','winter']){
    house.houseOptions={fireplace:true,recuperation:true,solarPanels:true,heatPump:true};
    const object=buildBuilding(house,false,undefined,season,model.exterior);
    result.push(['solar-panels','fireplace','fireplace-chimney','recuperation','heat-pump'].every(name=>!!object.getObjectByName(name)));disposeObject(object);
   }
   house.houseOptions={fireplace:false,recuperation:false,solarPanels:false,heatPump:false};
   const off=buildBuilding(house,false,undefined,'summer',model.exterior);result.push(!off.getObjectByName('solar-panels')&&!off.getObjectByName('heat-pump')&&!off.getObjectByName('fireplace'));disposeObject(off);
  }
  return result;
 });expect(geometry).toEqual(Array(12).fill(true));
 await page.locator('#b-dup').click();await expect(page.locator('#objs .obj')).toHaveCount(before+2);await expect(page.locator('#house-parking')).toHaveValue('carport');
 await page.locator('#house-parking').selectOption('none');await expect(page.locator('#objs .obj')).toHaveCount(before+1);
 await page.locator('#b-del').click();await expect(page.locator('#objs .obj')).toHaveCount(before);
 expect(errors).toEqual([]);
});
firstVisit('landing improves the native plan-to-house animation without a media player',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 const drawing=page.locator('.welcome-drawing');
 await expect(drawing.locator('.wd-world')).toBeVisible();
 await expect(drawing.locator('canvas,video,button,input,.welcome-film-controls,.welcome-film-caption')).toHaveCount(0);
 await expect(drawing.locator('.wd-carport3d')).toHaveCount(1);
 for(const name of ['solar','chimney','ventilation','heat-pump'])await expect(drawing.locator('.wd-'+name)).toHaveCount(1);
 await drawing.evaluate(el=>{for(const animation of el.getAnimations({subtree:true})){animation.pause();animation.currentTime=5300;}});
 await expect(drawing.locator('.wd-carport3d')).toBeVisible();await expect(drawing.locator('.wd-solar')).not.toBeVisible();
 await expect(drawing.locator('.wd-carport3d>.rt')).toHaveCSS('background-color','rgb(255, 106, 0)');
 await drawing.screenshot({path:'test-results/landing-native-carport.png'});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(drawing.locator('.wd-carport3d')).toHaveCSS('animation-name','none');
 await page.locator('[data-explore]').click();await expect(page.locator('.catalog-card').first()).toBeVisible();expect(errors).toEqual([]);
});
