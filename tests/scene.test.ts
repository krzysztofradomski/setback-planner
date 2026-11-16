import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScene, serializeScene, encodeShare, decodeShare } from '../public/core/scene.ts';
const legacy = () => ({plot:[{x:0,y:0},{x:24,y:0},{x:26,y:42},{x:-1,y:40}],items:[{id:'o1',type:'house',name:'Dom',x:12,y:17,w:12,d:10,rot:30,setback:4}],snap:0.5,dimScope:'selected',showPairs:false});
test('migrates unversioned projects without losing settings and round trips v2', () => {
  const scene=parseScene(legacy());
  assert.equal(scene.schemaVersion,2);
  assert.equal(scene.coordinates.crs,'LOCAL');
  assert.equal(scene.dimScope,'selected');
  assert.equal(scene.showPairs,false);
  assert.deepEqual(parseScene(JSON.parse(serializeScene(scene))),scene);
});
test('rejects future versions, duplicate IDs, unknown types and invalid geometry atomically', () => {
  assert.throws(()=>parseScene({...legacy(),schemaVersion:999}));
  assert.throws(()=>parseScene({...legacy(),items:[...legacy().items,...legacy().items]}));
  assert.throws(()=>parseScene({...legacy(),items:[{...legacy().items[0],type:'unknown'}]}));
  assert.throws(()=>parseScene({...legacy(),plot:[{x:0,y:0},{x:10,y:10},{x:0,y:10},{x:10,y:0}]}));
  assert.throws(()=>parseScene({...legacy(),items:[{...legacy().items[0],w:Infinity}]}));
});
test('new compressed and uncompressed links preserve full scene and legacy links load', async () => {
  const scene=parseScene(legacy());
  for(const compressed of [true,false]) assert.deepEqual(await decodeShare(await encodeShare(scene,compressed)),scene);
  const oldP='#p='+Buffer.from(JSON.stringify(legacy())).toString('base64url');
  assert.deepEqual(await decodeShare(oldP),scene);
  const positional=[legacy().plot.flatMap(p=>[p.x,p.y]),[['house','Dom',12,17,12,10,30,4]],0.5,'selected',0];
  const bytes=new TextEncoder().encode(JSON.stringify(positional));
  const zipped=await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
  assert.deepEqual((await decodeShare('#z='+Buffer.from(zipped).toString('base64url'))).items[0],scene.items[0]);
});
test('bounds both compressed and uncompressed input and rejects truncated state',async()=>{
  await assert.rejects(()=>decodeShare('#p='+'a'.repeat(400000)));
  await assert.rejects(()=>decodeShare('#s=invalid'));
  const bytes=new TextEncoder().encode(' '.repeat(300000));
  const zipped=await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
  await assert.rejects(()=>decodeShare('#s='+Buffer.from(zipped).toString('base64url')));
});
