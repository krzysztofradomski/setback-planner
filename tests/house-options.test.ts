import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalog} from '../public/core/catalogs.ts';
import {createCatalogItem,catalogCarport} from '../public/catalogs/placement.ts';
import {parseScene,serializeScene} from '../public/core/scene.ts';
import {setHouseParking,houseParking,resolveHouseOptions} from '../public/core/house-options.ts';
import {buildHouseSystems} from '../public/viewer/house-systems.ts';
const plot=[{x:0,y:0},{x:50,y:0},{x:50,y:50},{x:0,y:50}];
test('installation choices survive project and share serialization, and old projects retain catalog defaults',async()=>{
 const catalog=await loadCatalog('udana-budowa'),house=createCatalogItem(catalog,'de-105',{id:'h',x:25,y:25}),exterior=catalog.models[1].exterior!;
 assert.equal(resolveHouseOptions(house,exterior).solarPanels,true);
 house.houseOptions={fireplace:true,recuperation:true,solarPanels:false,heatPump:true};
 const saved=parseScene(JSON.parse(serializeScene(parseScene({plot,items:[house]}))));
 assert.deepEqual(saved.items[0].houseOptions,house.houseOptions);
 assert.throws(()=>parseScene({plot,items:[{...house,houseOptions:{...house.houseOptions,heatPump:'yes'}}]}));
});
test('parking switches replace only the managed annex, follow a rotated house, and honor locks and item limits',async()=>{
 const catalog=await loadCatalog('udana-budowa'),house=createCatalogItem(catalog,'de-105',{id:'h',x:25,y:25,rot:90}),exterior=catalog.models[1].exterior!;
 const unrelated={...house,id:'other',group:'',name:'Other'};
 let items=setHouseParking([house,unrelated],house.id,'carport',exterior,'port');
 assert.equal(houseParking(items,items[0]),'carport');assert.equal(items[2].attachedTo,'h');assert.equal(items[2].kind,'carport');
 assert.ok(Math.abs(items[2].y-(house.y-(house.w+3.9)/2-.02))<.0001);
 items=setHouseParking(items,'h','garage',exterior,'garage');
 assert.equal(items.length,3);assert.equal(items[2].type,'garage');assert.equal(items[2].openings[0].type,'door');assert.equal(items[1].id,'other');
 const locked=items.map(i=>i.id==='garage'?{...i,locked:true}:i);
 assert.throws(()=>setHouseParking(locked,'h','none',exterior,'unused'));
 items=setHouseParking(items,'h','none',exterior,'unused');assert.equal(items.length,2);assert.equal(houseParking(items,items[0]),'none');
 assert.throws(()=>setHouseParking([house,...Array.from({length:99},(_,i)=>({...unrelated,id:'x'+i}))],'h','carport',exterior,'overflow'));
});
test('legacy grouped catalog annex can be switched without accumulating structures',async()=>{
 const catalog=await loadCatalog('udana-budowa'),house=createCatalogItem(catalog,'de-75',{id:'h',x:25,y:25}),exterior=catalog.models[0].exterior!;house.group='legacy';
 const annex=catalogCarport(exterior,house,'old','Wiata')!;delete annex.attachedTo;
 const items=setHouseParking([house,annex],'h','garage',exterior,'new');assert.equal(items.length,2);assert.equal(items[1].id,'new');
});
test('each installation creates distinct geometry and disabling it removes it',async()=>{
 const catalog=await loadCatalog('udana-budowa'),house=createCatalogItem(catalog,'de-105',{id:'h',x:0,y:0});
 house.houseOptions={fireplace:true,recuperation:true,solarPanels:false,heatPump:true};
 const group=buildHouseSystems(house);
 for(const name of ['fireplace','fireplace-chimney','recuperation','heat-pump'])assert.ok(group.getObjectByName(name),name);
 house.houseOptions={fireplace:false,recuperation:false,solarPanels:false,heatPump:false};assert.equal(buildHouseSystems(house).children.length,0);
});
