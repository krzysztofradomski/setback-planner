import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchLocations } from '../public/core/address-search.ts';

const address={city:'Marki',street:'Generała Władysława Andersa',number:'1',jednostka:'{Polska,mazowieckie,wołomiński,Marki}',x:'644234.29',y:'499514.03'};
const envelope=(type='address',results:unknown={'1':address})=>JSON.stringify({type,'found objects':results===null?0:1,results});
const fake=(body:string,status=200):typeof fetch=>async()=>new Response(body,{status});

test('official UUG coordinates and labels become map candidates, not parcel records',async()=>{
  const candidates=await searchLocations('  Marki, Andersa 1  ',async(input,init)=>{
    const url=new URL(String(input));
    assert.equal(url.origin,'https://services.gugik.gov.pl');
    assert.equal(url.searchParams.get('request'),'GetAddress');
    assert.equal(url.searchParams.get('address'),'Marki, Andersa 1');
    assert.equal(init?.credentials,'omit');assert.equal(init?.redirect,'error');assert.equal(init?.referrerPolicy,'no-referrer');
    assert.ok(init?.signal);
    return new Response(envelope());
  });
  assert.equal(candidates.length,1);
  assert.match(candidates[0].label,/Marki, Generała Władysława Andersa 1/);
  assert.match(candidates[0].label,/mazowieckie/);
  assert.equal(candidates[0].kind,'address');assert.equal(candidates[0].provider,'GUGiK UUG');
  assert.ok(Math.abs(candidates[0].longitude-21.11795)<0.01);
  assert.ok(Math.abs(candidates[0].latitude-52.34259)<0.01);
  assert.equal('parcel' in candidates[0],false);
});
test('locality and street candidates retain their lower precision; empty results are not failures',async()=>{
  const locality={city:'Marki',voivodeship:'łódzkie',county:'bełchatowski',commune:'Drużbice',x:'523436',y:'398347'};
  const result=await searchLocations('Marki',fake(envelope('city',{'1':locality})));
  assert.equal(result[0].kind,'locality');assert.match(result[0].label,/Drużbice/);
  const street=await searchLocations('Marki, Andersa',fake(envelope('street',{'1':{...address,number:null}})));
  assert.equal(street[0].kind,'street');
  assert.deepEqual(await searchLocations('No such place',fake(envelope('city',null))),[]);
});
test('invalid queries never reach upstream',async()=>{
  let calls=0;const fetcher:typeof fetch=async()=>{calls++;return new Response(envelope());};
  for(const query of ['', 'ab', 'x'.repeat(201),'Warszawa\u0000'])await assert.rejects(()=>searchLocations(query,fetcher),/Enter/);
  assert.equal(calls,0);
});
test('malformed and untrusted coordinate responses fail closed',async()=>{
  for(const body of ['not json','{}',envelope('road'),envelope('address',[]),envelope('address',{'1':{...address,x:''}}),envelope('address',{'1':{...address,x:'21.1',y:'52.2'}}),envelope('address',{'1':{...address,x:'Infinity'}}),envelope('address',{'1':{...address,city:'<script>'}})]){
    await assert.rejects(()=>searchLocations('Marki',fake(body)),/Invalid/);
  }
});
test('HTTP errors, oversized bodies and caller cancellation remain distinguishable from no results',async()=>{
  await assert.rejects(()=>searchLocations('Marki',fake('error',503)),/unavailable/);
  await assert.rejects(()=>searchLocations('Marki',fake('x'.repeat(65537))),/too large/);
  const abort=new AbortController();abort.abort();let called=false;
  await assert.rejects(()=>searchLocations('Marki',async()=>{called=true;return new Response(envelope());},abort.signal),{name:'AbortError'});
  assert.equal(called,false);
});
test('result count and streamed byte bounds cannot be bypassed',async()=>{
  const results=Object.fromEntries(Array.from({length:16},(_,i)=>[String(i+1),address]));
  await assert.rejects(()=>searchLocations('Marki',fake(JSON.stringify({type:'address','found objects':16,results}))),/Invalid/);
  const chunks=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new TextEncoder().encode('ą'.repeat(32769)));controller.close();}});
  await assert.rejects(()=>searchLocations('Marki',async()=>new Response(chunks)),/too large/);
});
test('caller abort propagates to an in-flight fetch',async()=>{
  const abort=new AbortController();
  const fetcher:typeof fetch=async(_input,init)=>new Promise((_resolve,reject)=>{
    const signal=init?.signal;assert.ok(signal);
    signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
    abort.abort();
  });
  await assert.rejects(()=>searchLocations('Marki',fetcher,abort.signal),{name:'AbortError'});
});
