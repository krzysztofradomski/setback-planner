import { test } from 'node:test';import assert from 'node:assert/strict';
import {objectLibrary,blocksPlacement} from '../public/core/objects.ts';
import {parseScene,serializeScene} from '../public/core/scene.ts';
import {outdoorModel} from '../public/viewer/outdoor.ts';
import {disposeObject} from '../public/viewer/model.ts';
test('every garden object validates, round trips and renders dimensional geometry',()=>{
 for(const [kind,v]of Object.entries(objectLibrary)){
 const scene=parseScene({plot:[{x:0,y:0},{x:30,y:0},{x:30,y:40},{x:0,y:40}],items:[{id:'a',type:'landscape',kind,name:v.en,x:10,y:10,w:v.w,d:v.d,setback:0,architecture:{height:v.height,roof:'flat',pitch:0,storeys:1}}]});
 assert.deepEqual(parseScene(JSON.parse(serializeScene(scene))),scene);const mesh=outdoorModel(scene.items[0]);assert.ok(mesh.children.length>0);disposeObject(mesh);
 }
 assert.equal(blocksPlacement({type:'landscape',kind:'lawn'}),false);assert.equal(blocksPlacement({type:'house'}),true);
});
