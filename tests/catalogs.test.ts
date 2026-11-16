import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, catalogAvailable } from '../public/core/catalogs.ts';
import { parseScene } from '../public/core/scene.ts';
test('registered catalog exposes published models without fabricated dimensions or prices',async()=>{
  const catalog=await loadCatalog('udana-budowa');
  assert.deepEqual(catalog.models.map(m=>m.name),['DE 75','DE 105','DE 135','DE 165']);
  for(const model of catalog.models) {assert.equal(model.footprint,null);assert.equal(model.price,null);}
  await assert.rejects(()=>loadCatalog('https://untrusted.example/module.js'));
});
test('disabling or missing catalog preserves saved fallback geometry and references',()=>{
  const reference={catalogId:'udana-budowa',catalogVersion:'2026-11-16',modelId:'de-75',modelVersion:'metadata-1'};
  const scene=parseScene({plot:[{x:0,y:0},{x:30,y:0},{x:30,y:40},{x:0,y:40}],items:[{id:'o1',type:'house',name:'User fallback',x:15,y:20,w:10,d:8,catalog:reference}]});
  const original=JSON.stringify(scene);
  assert.equal(catalogAvailable(reference,[]),false);
  assert.equal(catalogAvailable(reference,['udana-budowa']),true);
  assert.equal(catalogAvailable({...reference,catalogId:'missing'},['missing']),false);
  assert.equal(JSON.stringify(scene),original);
  assert.deepEqual(parseScene(JSON.parse(original)),scene);
});
