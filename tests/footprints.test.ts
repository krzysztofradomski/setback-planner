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
