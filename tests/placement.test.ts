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
test('re-seating keeps grouped structures (house + carport) rigidly together',async()=>{
  const {fitItemsToParcel}=await import('../public/core/placement.ts');
  const scene=parseScene({plot:[{x:0,y:0},{x:40,y:0},{x:40,y:30},{x:0,y:30}],items:[
    {id:'h',type:'house',name:'H',x:-100,y:-100,w:12,d:8,setback:4,group:'g1'},
    {id:'c',type:'landscape',kind:'pergola',name:'C',x:-91,y:-99,w:4,d:6,setback:0,group:'g1'}]});
  const [h,c]=fitItemsToParcel(scene);
  const before=Math.hypot(-91+100,-99+100),after=Math.hypot(c.x-h.x,c.y-h.y);
  assert.ok(Math.abs(before-after)<1e-9,'distance between members is preserved');
  assert.ok(Math.abs((c.rot-h.rot)-0)<1e-9,'relative rotation is preserved');
  assert.ok(parcelContains(scene,worldFootprint(h)));
});
test('a house and its carport are seated together, each keeping its own setback',async()=>{
  const {placeGroup,setbackArea}=await import('../public/core/placement.ts');
  // 24 m wide parcel: a 12 m house fits alone in the 16 m wide setback area, but house + 4 m carport only off-centre.
  const scene=parseScene({plot:[{x:0,y:0},{x:24,y:0},{x:24,y:30},{x:0,y:30}],items:[
    {id:'h',type:'house',name:'H',x:12,y:15,w:12,d:9,setback:4,group:'g1'},
    {id:'c',type:'landscape',kind:'carport',name:'C',x:4,y:15,w:3.5,d:6,setback:3,group:'g1',attachedTo:'h'}]});
  const [h,c]=placeGroup(scene,scene.items)!;
  for(const it of [h,c])assert.ok(setbackArea(scene,it.setback).parts.some(([outer,...holes])=>parcelContains({plot:outer,plotHoles:holes},worldFootprint(it))),it.id+' keeps its setback');
  assert.ok(Math.abs(Math.hypot(c.x-h.x,c.y-h.y)-8)<1e-6,'carport stays beside the house');
  const tiny=parseScene({plot:[{x:0,y:0},{x:14,y:0},{x:14,y:14},{x:0,y:14}],items:scene.items});
  assert.equal(placeGroup(tiny,tiny.items),null);
});
test('with a street edge the house front faces the street, about 6 m back from it',async()=>{
  const {placeGroup,streetFacingRotation}=await import('../public/core/placement.ts');
  const plot=[{x:0,y:0},{x:30,y:0},{x:30,y:40},{x:0,y:40}],scene=parseScene({plot,items:[{id:'h',type:'house',name:'H',x:15,y:20,w:12,d:8,setback:4}]});
  const front=(rot:number)=>{const r=rot*Math.PI/180;return [Math.round(-Math.sin(r)*1e6)/1e6+0,Math.round(Math.cos(r)*1e6)/1e6+0];};
  for(const [edge,dir] of [[2,[0,1]],[0,[0,-1]],[1,[1,0]],[3,[-1,0]]] as const){
    const street:[typeof plot[0],typeof plot[0]]=[plot[edge],plot[(edge+1)%4]],[h]=placeGroup(scene,scene.items,street)!;
    assert.deepEqual(front(h.rot),dir,'front toward edge '+edge);assert.deepEqual(front(streetFacingRotation(plot,street)),dir);
    const toStreet=edge===2?40-h.y:edge===0?h.y:edge===1?30-h.x:h.x;assert.ok(Math.abs(toStreet-10)<=2,'front wall about 6 m from the street, centre got '+toStreet);
    assert.ok(parcelContains(scene,worldFootprint(h)));
  }
});
