import{test}from'node:test';import assert from'node:assert/strict';import{setbackArea,suggestPlacements}from'../public/core/placement.ts';import{parseScene}from'../public/core/scene.ts';import{parcelContains}from'../public/core/topology.ts';import{worldFootprint}from'../public/core/footprints.ts';
test('metric setbacks erode boundaries and placement suggestions are deterministic',()=>{const scene=parseScene({plot:[{x:0,y:0},{x:30,y:0},{x:30,y:40},{x:0,y:40}],items:[{id:'a',type:'house',name:'A',x:1,y:1,w:10,d:8,setback:4}]});assert.equal(setbackArea(scene,4).area,22*32);const a=suggestPlacements(scene,scene.items[0]);assert.ok(a.suggestions.length);assert.deepEqual(a,suggestPlacements(scene,scene.items[0]));for(const p of a.suggestions)assert.ok(parcelContains(scene,worldFootprint({...scene.items[0],...p})));assert.equal(setbackArea(scene,100).area,0);});
test('switching parcels re-seats unlocked buildings inside the new setback area, aligned to its longest edge',async()=>{
  const {fitItemsToParcel}=await import('../public/core/placement.ts');
  const r=35*Math.PI/180,rot=(x:number,y:number)=>({x:200+x*Math.cos(r)-y*Math.sin(r),y:100+x*Math.sin(r)+y*Math.cos(r)});
  const scene=parseScene({plot:[rot(0,0),rot(40,0),rot(40,28),rot(0,28)],items:[
    {id:'h',type:'house',name:'H',x:0,y:0,w:12,d:10,setback:4},
    {id:'g',type:'garage',name:'G',x:5,y:5,w:6,d:7,setback:3},
    {id:'l',type:'house',name:'L',x:-50,y:-50,w:8,d:8,setback:4,locked:true}]});
  const items=fitItemsToParcel(scene),[h,g,l]=items;
  for(const it of [h,g]){assert.ok(parcelContains(scene,worldFootprint(it)),it.id+' inside parcel');}
  assert.ok([35,-55,125].some(a=>Math.abs(h.rot-a)<1e-6),'house follows the long edge, got '+h.rot);
  const {polygonRelation}=await import('../public/core/geometry.ts');assert.equal(polygonRelation(worldFootprint(h),worldFootprint(g)),'disjoint');
  assert.deepEqual([l.x,l.y],[-50,-50],'locked items stay put');
  assert.deepEqual(items,fitItemsToParcel(scene),'deterministic');
});
