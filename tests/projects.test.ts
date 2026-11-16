import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectHistory, saveVariant, readVariants } from '../public/core/projects.ts';
import { parseScene } from '../public/core/scene.ts';
const scene=()=>parseScene({plot:[{x:0,y:0},{x:20,y:0},{x:20,y:30},{x:0,y:30}],items:[]});
test('history restores full state, isolates mutations and drops redo after new edits',()=>{
  const history=new ProjectHistory(2), first=scene(),next=scene();next.showPairs=false;
  history.record(first);first.snap=1;
  const restored=history.undo(next)!;
  assert.equal(restored.snap,0.5);assert.equal(restored.showPairs,true);
  assert.equal(history.redo(restored)!.showPairs,false);
  history.undo(next);history.record(restored);assert.equal(history.redo(restored),null);
});
test('named variants validate, isolate state, replace by ID and cap local collection',()=>{
  let list=saveVariant([], {id:'a',name:'A',scene:scene()});
  const next=scene();next.snap=1;
  list=saveVariant(list,{id:'a',name:'B',scene:next});next.snap=0;
  assert.equal(list.length,1);assert.equal(list[0].scene.snap,1);
  assert.deepEqual(readVariants(JSON.stringify(list)),list);
  assert.throws(()=>readVariants('{broken'));
  assert.throws(()=>saveVariant(list,{id:'x',name:'',scene:scene()}));
  for(let i=0;i<19;i++)list=saveVariant(list,{id:String(i),name:'Variant',scene:scene()});
  assert.throws(()=>saveVariant(list,{id:'overflow',name:'Overflow',scene:scene()}));
});
