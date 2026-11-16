import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{buildingsFromTile,estimateHeight,orthoUrl,contextBounds,tileOf}from'../public/core/context.ts';
import{parseScene}from'../public/core/scene.ts';import{geographicPoint}from'../public/core/geospatial.ts';
// Real VersaTiles z14 tile (Marki), © OpenStreetMap contributors, ODbL.
const tile=new Uint8Array(readFileSync(new URL('./fixtures/versatiles-14-9153-5386.pbf',import.meta.url)));
const origin={x:644232.14,y:499524.66};
const scene=parseScene({schemaVersion:2,units:'m',plot:[{x:0,y:0},{x:30,y:0},{x:30,y:40},{x:0,y:40}],items:[],coordinates:{crs:'LOCAL',axis:'x-east-y-south',projected:{crs:'EPSG:2180',origin}}});
test('the parcel origin falls in the fixture tile',()=>{const[lon,lat]=geographicPoint([origin.x,origin.y]);assert.deepEqual(tileOf(lon,lat),{x:9153,y:5386});});
test('tile buildings land in local metres around the parcel with labelled estimated heights',async()=>{
  const {center,half}=contextBounds(scene),b=await buildingsFromTile(tile,9153,5386,scene,center,half);
  assert.ok(b.length>20,'suburban block has many neighbours, got '+b.length);
  for(const x of b){assert.ok(x.ring.length>=3);const c=x.ring[0];assert.ok(Math.abs(c.x-center.x)<half+60&&Math.abs(c.y-center.y)<half+60,'inside the context square');assert.equal(x.heightSource,'default');}
  assert.deepEqual(b,await buildingsFromTile(tile,9153,5386,scene,center,half),'deterministic');
});
test('height estimate prefers explicit metres, then levels, then a labelled default',()=>{
  assert.deepEqual(estimateHeight({height:'9.5'}),{height:9.5,heightSource:'tag'});
  assert.equal(estimateHeight({'building:levels':'1','roof:levels':'1'}).height,1.6*3+.5);
  assert.equal(estimateHeight({}).heightSource,'default');
});
test('orthophoto request covers the context square in PL-1992 easting/northing order',()=>{
  const u=new URL(orthoUrl({x:651000,y:497200},{x:15,y:20},85));
  assert.equal(u.searchParams.get('SRS'),'EPSG:2180');
  assert.equal(u.searchParams.get('BBOX'),'650930.00,497095.00,651100.00,497265.00');
});
