import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookupParcel, parseUldkResponse } from '../public/core/uldk.ts';
const fixture=readFileSync('tests/fixtures/uldk-parcel.txt','utf8');
test('official ULDK WKT fixture imports with source, identifier and timestamp',()=>{
  const result=parseUldkResponse(fixture,'141201_1.0001.6509','2026-11-16T12:00:00Z');
  assert.equal(result.plot.length,7);assert.equal(result.parcel.identifier,'141201_1.0001.6509');
  assert.equal(result.parcel.source.url,'https://uldk.gugik.gov.pl/');
  assert.equal(result.parcel.edited,false);
});
test('service failures and mismatched SRID never become parcel geometry',()=>{
  for(const response of ['-1\nNot found','0\nSRID=4326;POLYGON((0 0,1 0,1 1,0 0))','0\nnot geometry','1\nPOLYGON EMPTY']) assert.throws(()=>parseUldkResponse(response,'141201_1.0001.6509','2026-11-16T12:00:00Z'));
});
test('lookup validates request parameters and handles upstream and oversized failures',async()=>{
  let called=false;
  const fetcher:typeof fetch=async(input,init)=>{
    called=true;const url=new URL(String(input));assert.equal(url.origin,'https://uldk.gugik.gov.pl');assert.equal(url.searchParams.get('srid'),'2180');assert.equal(init?.credentials,'omit');return new Response(fixture);
  };
  await assert.rejects(()=>lookupParcel('invalid',fetcher));assert.equal(called,false);
  const result=await lookupParcel('141201_1.0001.6509',fetcher);assert.equal(result.plot.length,7);
  await assert.rejects(()=>lookupParcel('141201_1.0001.6509',async()=>new Response('error',{status:503})));
  await assert.rejects(()=>lookupParcel('141201_1.0001.6509',async()=>new Response('a'.repeat(300000))));
});
