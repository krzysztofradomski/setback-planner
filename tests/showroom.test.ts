import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAttribution,validateAttribution,campaignLabel,inactivitySettings,clearKioskStorage,exampleScene,publicProjectUrl,KIOSK_PREFIX } from '../public/core/showroom.ts';
import { parseScene } from '../public/core/scene.ts';
test('campaign attribution accepts only bounded labels and keeps timestamps',()=>{
  const first=readAttribution('?utm_source=fair&event=Warsaw%202026&email=person@example.com',null,new Date('2026-11-16T10:00:00Z'))!;
  assert.equal(first.event,'Warsaw 2026');assert.equal('email' in first,false);
  const next=readAttribution('?utm_campaign=winter',first,new Date('2026-11-16T11:00:00Z'))!;
  assert.equal(next.firstSeenAt,first.firstSeenAt);assert.equal(next.lastSeenAt,'2026-11-16T11:00:00.000Z');assert.equal(next.utm_source,'fair');
  for(const value of ['x'.repeat(81),'person@example.com','https://example.com','<script>','a\n b'])assert.equal(campaignLabel(value),undefined);
  assert.equal(validateAttribution({utm_source:'x',firstSeenAt:'bad',lastSeenAt:'bad'}),null);
  assert.equal(readAttribution('?utm_source=person@example.com'),null);
});
test('inactivity config is bounded and guarantees a warning interval',()=>{
  assert.deepEqual(inactivitySettings(-1,999),{idleSeconds:30,warningSeconds:20});
  assert.deepEqual(inactivitySettings(Infinity,NaN),{idleSeconds:180,warningSeconds:20});
  assert.equal(inactivitySettings(9999).idleSeconds,1800);
});
test('reset deletes only kiosk namespace and preserves ordinary projects and attribution',()=>{
  const values=new Map([['projects','saved'],['variants','saved'],['setback-planner:attribution:v1','campaign'],[KIOSK_PREFIX+'contact','private'],[KIOSK_PREFIX+'draft','private']]);
  clearKioskStorage({get length(){return values.size;},key:i=>[...values.keys()][i]??null,removeItem:key=>{values.delete(key);}});
  assert.deepEqual([...values.keys()],['projects','variants','setback-planner:attribution:v1']);
});
test('generic demos validate and are detached from subsequent sessions',()=>{
  for(const kind of ['compact','garden'] as const){const scene=exampleScene(kind);assert.deepEqual(parseScene(scene),scene);scene.items[0].x=999;assert.equal(exampleScene(kind).items[0].x,10);}
});
test('public transfer strips query data and refuses external or missing scene links',()=>{
  assert.equal(publicProjectUrl('https://planner.test/?email=private#p=abc','https://planner.test/'),'https://planner.test/#p=abc');
  assert.throws(()=>publicProjectUrl('https://evil.test/#p=abc','https://planner.test/'));
  assert.throws(()=>publicProjectUrl('#unknown','https://planner.test/'));
});
