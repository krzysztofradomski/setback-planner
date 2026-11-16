import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { buildBuilding, disposeObject } from '../public/viewer/model.ts';
import { worldFootprint } from '../public/core/footprints.ts';
import { parseScene } from '../public/core/scene.ts';
const item=()=>parseScene({plot:[{x:0,y:0},{x:40,y:0},{x:40,y:50},{x:0,y:50}],items:[{id:'a',type:'house',name:'Generic',x:14,y:20,w:12,d:8,rot:33}]}).items[0];
test('3D uses identical metric ground footprint and transforms as 2D for every shape',()=>{
  for(const shape of ['rectangle','L','T','U'] as const){
    const object={...item(),shape},group=buildBuilding(object);
    assert.deepEqual(group.userData.footprint,worldFootprint(object));
    group.updateMatrixWorld(true);
    const bounds=new Box3().setFromObject(group,true);
    const points=worldFootprint(object);
    assert.ok(Math.abs(bounds.min.x-Math.min(...points.map(p=>p.x)))<1e-5);
    assert.ok(Math.abs(bounds.max.z-Math.max(...points.map(p=>p.y)))<1e-5);
    assert.ok(bounds.max.y>=object.architecture.height);
    assert.equal(group.children.filter(o=>o.name.startsWith('wall-')).length,points.length);
    disposeObject(group);
  }
});
test('rectangular roof rise uses physical pitch and per-wall overrides do not mutate defaults',()=>{
  const object=item();object.rot=0;object.architecture.pitch=45;object.appearance={walls:{'1':'wood'}};
  const group=buildBuilding(object);
  const bounds=new Box3().setFromObject(group,true);
  assert.ok(Math.abs(bounds.max.y-(object.architecture.height+object.w/2))<1e-5);
  assert.equal(group.getObjectByName('wall-1')!.userData.materialId,'wood');
  assert.equal(buildBuilding(object,true).getObjectByName('wall-1')!.userData.materialId,'plaster');
});
