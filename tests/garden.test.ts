import{test}from'node:test';import assert from'node:assert/strict';
import{designGarden}from'../public/core/garden.ts';import{parseScene}from'../public/core/scene.ts';
import{parcelContains}from'../public/core/topology.ts';import{worldFootprint}from'../public/core/footprints.ts';import{polygonRelation}from'../public/core/geometry.ts';
const scene=parseScene({plot:[{x:0,y:0},{x:30,y:0},{x:30,y:45},{x:0,y:45}],items:[{id:'h',type:'house',name:'H',x:15,y:22,w:12,d:9,setback:4},{id:'g',type:'garage',name:'G',x:25,y:22,w:3.5,d:6,setback:3}]});
for(const style of ['family','modern','natural','lush'] as const)test(`${style} garden fits the parcel without overlaps and is deterministic`,()=>{
  let n=0;const run=()=>designGarden(scene,style,()=>'n'+n++,k=>k);
  const {items,hedge}=run();n=0;assert.deepEqual(run().items.map(i=>[i.kind,i.x,i.y]),items.map(i=>[i.kind,i.x,i.y]));
  const kinds=items.map(i=>i.kind);assert.ok(kinds.includes('terrace')&&kinds.includes('path')&&kinds.includes('driveway'),kinds.join());
  assert.ok(items.length>=7,'style objects placed: '+kinds.join());
  const all=[...scene.items,...items];
  for(const it of items){assert.ok(parcelContains(scene,worldFootprint(it)),it.kind+' inside');for(const o of all)if(o!==it)assert.equal(polygonRelation(worldFootprint(it),worldFootprint(o)),'disjoint',`${it.kind} vs ${o.kind??o.type}`);}
  const path=items.find(i=>i.kind==='path')!;assert.ok(path.y>22+4.5,'path runs from the front (south) side');
  const terrace=items.find(i=>i.kind==='terrace')!;assert.ok(terrace.y<22-4.5,'terrace is behind the house');
  assert.equal(hedge.length,4);assert.deepEqual([hedge[0],hedge.at(-1)],[{x:0,y:45},{x:30,y:45}],'hedge leaves the street edge (y=45) open');
});
test('requested extras are placed first and avoided elements never appear',()=>{
  let n=0;const {items}=designGarden(scene,'family',()=>'x'+n++,k=>k,null,{add:['pool','greenhouse'],avoid:['swing','sandbox']});
  const kinds=items.map(i=>i.kind);assert.ok(kinds.includes('pool')&&kinds.includes('greenhouse'),kinds.join());assert.ok(!kinds.includes('swing')&&!kinds.includes('sandbox'));
  n=0;const lush=designGarden(scene,'lush',()=>'y'+n++,k=>k).items;assert.ok(lush.length>=15,'lush garden is planting-rich: '+lush.length);
});
