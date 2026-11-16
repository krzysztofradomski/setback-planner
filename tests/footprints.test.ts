import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localFootprint, worldFootprint, boundingCorners } from '../public/core/footprints.ts';
import { polygonArea, validRing } from '../public/core/geometry.ts';
const base={x:12,y:14,w:10,d:20,rot:37,wingRatio:0.3};
test('parametric rectangle L T U footprints remain simple and preserve area under transforms',()=>{
  for(const shape of ['rectangle','L','T','U'] as const) for(const wingRatio of [0.15,0.3,0.45]) {
    const item={...base,shape,wingRatio},local=localFootprint(item),world=worldFootprint(item);
    assert.equal(validRing(local),true);assert.equal(validRing(world),true);
    const expected=shape==='rectangle'?200:shape==='U'?200*(3*wingRatio-2*wingRatio**2):200*(2*wingRatio-wingRatio**2);
    assert.ok(Math.abs(polygonArea(local)-expected)<1e-8);
    assert.ok(Math.abs(polygonArea(local)-polygonArea(world))<1e-8);
    assert.equal(boundingCorners(item).length,4);
  }
});
test('default footprint remains the legacy rectangle',()=>{
  assert.deepEqual(localFootprint(base),[{x:-5,y:-10},{x:5,y:-10},{x:5,y:10},{x:-5,y:10}]);
});
test('openings slide and shrink to stay inside resized walls so projects keep saving',async()=>{
  const {fitOpenings}=await import('../public/core/footprints.ts');const {parseScene}=await import('../public/core/scene.ts');
  const item={x:0,y:0,rot:0,w:11.76,d:7.84,shape:'rectangle' as const,architecture:{height:3.2},openings:[{edge:2,offset:8.17,width:2.5,height:1.45,sill:.85,type:'window' as const},{edge:0,offset:1,width:1,height:2.3,sill:0,type:'door' as const}]};
  const resized={...item,w:10,architecture:{height:2,storeys:1,roof:'gable' as const,pitch:30}},fitted=fitOpenings(resized);
  assert.ok(fitted[0].offset+fitted[0].width<=10,'slid back inside the shorter wall');assert.equal(fitted[0].width,2.5,'kept its size');
  assert.ok(fitted[1].sill+fitted[1].height<=2,'door lowered to the new wall height');
  assert.equal(fitOpenings(item)[0],item.openings[0],'untouched when it already fits');
  parseScene({schemaVersion:2,units:'m',coordinates:{crs:'LOCAL',axis:'x-east-y-south'},plot:[{x:-20,y:-20},{x:20,y:-20},{x:20,y:20},{x:-20,y:20}],items:[{id:'h',type:'house',name:'H',...resized,setback:4,openings:fitted}]});
});
