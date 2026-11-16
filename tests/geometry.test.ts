import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validRing, polygonRelation, containsPolygon, polygonArea, transformFootprint, polygonDistance } from '../public/core/geometry.ts';
const rect = (x:number,y:number,w:number,d:number) => [{x,y},{x:x+w,y},{x:x+w,y:y+d},{x,y:y+d}];
test('rejects bow ties, repeated vertices, zero area and nonfinite points', () => {
  assert.equal(validRing(rect(0,0,10,10)),true);
  assert.equal(validRing([{x:0,y:0},{x:10,y:10},{x:0,y:10},{x:10,y:0}]),false);
  assert.equal(validRing([{x:0,y:0},{x:1,y:0},{x:0,y:0}]),false);
  assert.equal(validRing(rect(0,0,0,10)),false);
  assert.equal(validRing(rect(Infinity,0,10,10)),false);
});
test('distinguishes shared edges from positive area overlaps, including collinear cases', () => {
  assert.equal(polygonRelation(rect(0,0,10,4),rect(9,0,10,4)),'overlap');
  assert.equal(polygonRelation(rect(0,0,10,4),rect(10,0,10,4)),'touch');
  assert.equal(polygonRelation(rect(0,0,10,4),rect(11,0,10,4)),'disjoint');
  assert.equal(polygonRelation(rect(0,0,10,4),rect(0,0,10,4)),'overlap');
  assert.equal(polygonDistance(rect(0,0,10,4),rect(11,0,10,4)).distance,1);
});
test('containment checks edges crossing concave parcel even when all corners are inside', () => {
  const u = [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:7,y:10},{x:7,y:3},{x:3,y:3},{x:3,y:10},{x:0,y:10}];
  assert.equal(containsPolygon(u,rect(1,5,8,3)),false);
  assert.equal(containsPolygon(u,rect(0,0,10,2)),true);
});
test('rotation and translation preserve area and distances across deterministic samples', () => {
  for(let rotation=0;rotation<360;rotation+=7) {
    const shape = transformFootprint(rect(-5,-2,10,4), {x:123,y:-44,rot:rotation});
    assert.ok(Math.abs(polygonArea(shape)-40)<1e-8);
    assert.equal(validRing(shape),true);
  }
});
