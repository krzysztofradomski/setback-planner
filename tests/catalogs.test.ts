import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { loadCatalog, catalogAvailable } from '../public/core/catalogs.ts';
import { createCatalogItem } from '../public/catalogs/placement.ts';
import { parseScene } from '../public/core/scene.ts';
test('registered catalog exposes dimensions transcribed from manufacturer plans and bundled assets',async()=>{
  const catalog=await loadCatalog('udana-budowa');
  assert.deepEqual(catalog.models.map(m=>[m.name,m.footprint?.width,m.footprint?.depth]),[
    ['DE 75',11.76,7.84],['DE 105',13.1,9.98],['DE 135',16.1,9.98],['DE 165',18.08,10.8],
  ]);
  for(const model of catalog.models) {
    assert.equal(model.price,null); assert.equal(model.height,null); assert.equal(model.roof.pitch,null);
    assert.equal(model.geometryStatus,'verified-envelope');
    assert.match(model.footprint.source,/^https:\/\/udanabudowa\.pl\/img\/dom\d+_\d+\.jpg$/);
    for(const asset of [model.thumbnail,model.plan]) assert.ok(existsSync(new URL(`../public${asset}`,import.meta.url)));
  }
  assert.equal(catalog.models[0].floorArea,75.6);
  assert.equal(catalog.models[0].footprintArea,92.2);
  await assert.rejects(()=>loadCatalog('https://untrusted.example/module.js'));
});
test('catalog placement preserves source reference and measured envelope in a self-contained saved item',async()=>{
  const catalog=await loadCatalog('udana-budowa');
  const item=createCatalogItem(catalog,'de-105',{id:'catalog-house',x:15,y:20,rot:90});
  assert.equal(item.w,13.1); assert.equal(item.d,9.98); assert.equal(item.rot,90);
  assert.equal(item.catalog?.modelVersion,'plan-1');
  assert.equal(item.architecture.roof,'gable');
  assert.throws(()=>createCatalogItem(catalog,'missing',{id:'bad',x:0,y:0}));
  const scene=parseScene({plot:[{x:0,y:0},{x:50,y:0},{x:50,y:50},{x:0,y:50}],items:[item]});
  assert.deepEqual(parseScene(JSON.parse(JSON.stringify(scene))),scene);
});
test('disabling or missing catalog preserves saved fallback geometry and legacy references',()=>{
  const reference={catalogId:'udana-budowa',catalogVersion:'2026-11-16',modelId:'de-75',modelVersion:'metadata-1'};
  const scene=parseScene({plot:[{x:0,y:0},{x:30,y:0},{x:30,y:40},{x:0,y:40}],items:[{id:'o1',type:'house',name:'User fallback',x:15,y:20,w:10,d:8,catalog:reference}]});
  const original=JSON.stringify(scene);
  assert.equal(catalogAvailable(reference,[]),false);
  assert.equal(catalogAvailable(reference,['udana-budowa']),true);
  assert.equal(catalogAvailable({...reference,catalogId:'missing'},['missing']),false);
  assert.equal(JSON.stringify(scene),original);
  assert.deepEqual(parseScene(JSON.parse(original)),scene);
});
