import{test}from'node:test';import assert from'node:assert/strict';import{planFromBrief}from'../public/core/brief.ts';
const base={storeys:null,floorArea:null,width:null,depth:null,roof:null,pitch:null,garage:null,cars:null,summary:''};
const catalog=[{id:'de-105',width:13.1,depth:9.98},{id:'de-165',width:18.08,depth:10.8}];
test('floor area becomes an estimated footprint with the usual proportions and a close catalogue match',()=>{
  const p=planFromBrief({...base,floorArea:105,storeys:1,roof:'gable',garage:'attached',cars:2},catalog);
  assert.ok(Math.abs(p.w*p.d-126)<1,'105 m² usable ≈ 126 m² gross');assert.ok(p.w>p.d);
  assert.deepEqual(p.estimated,['size']);assert.equal(p.pitch,35);assert.deepEqual(p.garage,{kind:'attached',w:6,d:6});
  assert.equal(p.match,'de-105');
});
test('explicit dimensions win, two storeys halve the footprint and skip single-storey catalogue matches',()=>{
  assert.deepEqual([planFromBrief({...base,width:14,depth:9},catalog).w,planFromBrief({...base,width:14,depth:9},catalog).d],[14,9]);
  const two=planFromBrief({...base,floorArea:160,storeys:2},catalog);assert.ok(Math.abs(two.w*two.d-96)<1);assert.equal(two.match,null);assert.equal(two.height,5.8);
  assert.deepEqual(planFromBrief(base).estimated,['storeys','size','roof']);
});
