import{test}from'node:test';import assert from'node:assert/strict';
import{searchPlans,actText,planScope,ruleExcerpt,streetsNear}from'../public/core/local-plan.ts';
const journal=(routes:Record<string,unknown>)=>(async(url:string)=>{const path=String(url).replace('https://j.test','');const hit=Object.entries(routes).find(([k])=>path.startsWith(k));return new Response(hit?JSON.stringify(hit[1]):'nope',{status:hit?200:404});})as unknown as typeof fetch;
test('journal search keeps only plan resolutions, newest first, deduplicated',async()=>{
  const f=journal({'/api/SearchLegalAct':{LegalActs:[{Oid:2,Year:2013,Position:5,Title:'Uchwała … w sprawie miejscowego planu zagospodarowania przestrzennego miasta X'},{Oid:3,Year:2020,Position:1,Title:'Uchwała w sprawie podatku'},{Oid:4,Year:2019,Position:9,Subject:'w sprawie zagospodarowania przestrzennego gminy X'},{Oid:6,Year:2025,Position:8,Title:'Uchwała … planu zagospodarowania przestrzennego gm. X dla wsi Q'},{Oid:5,Year:2026,Position:3,Title:'Uchwała Rady Miejskiej w Y w sprawie miejscowego planu zagospodarowania przestrzennego pn. „X IV”'}]}});
  const r=await searchPlans('https://j.test','','X',f);
  assert.deepEqual(r.map(c=>c.oid),[6,4,2]);
  assert.deepEqual((await searchPlans('https://j.test','X','X',f)).map(c=>c.oid),[2]);// town plot: the town's plans onlyassert.equal(r[1].url,'https://j.test/legalact/2013/5/');
});
test('act text is plain paragraphs; scanned acts return null',async()=>{
  const f=journal({'/api/LegalActHtml/1':{IsSuccess:true,Content:'<p>§ 1. Uchwala się plan dla terenu ograniczonego ul. A.</p><p>10) dopuszcza się garaże w odległości 1.5m od granicy działki lub bezpośrednio przy granicy działki.</p><p>Podatek&nbsp;rolny.</p>'},'/api/LegalActHtml/2':{IsSuccess:false}});
  const t=(await actText('https://j.test',1,f))!;
  assert.match(planScope(t),/^Uchwala się plan dla terenu ograniczonego ul\. A\./);
  assert.equal(ruleExcerpt(t).trim(),'10) dopuszcza się garaże w odległości 1.5m od granicy działki lub bezpośrednio przy granicy działki.');
  assert.equal(await actText('https://j.test',2,f),null);
});
test('streets near a point report distance and the side they lie on',()=>{
  const lines=[{name:'Ulica Wschodnia',points:[[110,-50],[110,50]]as [number,number][]},{name:'Daleka',points:[[0,900],[10,900]]as [number,number][]},{name:'Północna',points:[[60,30],[140,30]]as [number,number][]}];
  assert.deepEqual(streetsNear(lines,100,0),[{name:'Ulica Wschodnia',distance:10,side:'wschód'},{name:'Północna',distance:30,side:'północ'}]);
});
test('a whole-issue PDF: the act starts where the table of contents says, offset by the page header',async()=>{
  const {actPages}=await import('../public/core/local-plan.ts');
  const ocr='DZIENNIK URZĘDOWY\nTREŚĆ:\n2102 – uchwała nr XXIX/212/2010 Rady Powiatu ......... 20140\n2103 – uchwała nr XLV/314/10 Rady Miejskiej w Błoniu w sprawie planu ......... 20142\n2104 – uchwała nr XLVII/332/10 Rady Miejskiej w Błoniu ......... 20160\nDziennik Urzędowy\nWojewództwa Mazowieckiego Nr 107 – 20126 – Poz. 2101\n2112 – uchwała ......... 20259';
  assert.deepEqual(actPages(ocr,2103),{start:18,end:35});
  assert.equal(actPages('§ 1. Uchwala się plan',2103),null);
});
test('zone symbols read off the plan drawing rank the plan that defines them',async()=>{
  const {planSymbols,symbolHits}=await import('../public/core/local-plan.ts');
  const syms=planSymbols('K 17,0 6,0 20MN 20KDD 5,0 12,0 21MN KDZ 6');
  assert.deepEqual(syms,['20MN','20KDD','21MN','KDZ']);
  assert.equal(symbolHits('tereny o symbolu 1MN, 2MN, 20MN, 21MN: … symbol KDZ – droga zbiorcza; 20 KDD',syms),4);
  assert.equal(symbolHits('tereny o symbolu 1MNU, 21MNU',syms),0);
});
