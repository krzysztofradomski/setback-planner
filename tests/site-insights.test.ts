import{test}from'node:test';import assert from'node:assert/strict';
import{tileElements,readRcn,priceSummary,readOsm,readOtodom,readOlx,distanceToParcel,pointsToParcel,parseInsightsQuery,slug}from'../public/core/site-insights.ts';
import{soilClasses}from'../public/core/report-insights.ts';
import{geographicPoint as geo}from'../public/core/geospatial.ts';
import{projectReport}from'../public/core/reports.ts';
import{geographicPoint,projectPoint}from'../public/core/geospatial.ts';
import{parseScene}from'../public/core/scene.ts';
// Response shapes as served by the live services on 2026-11-23 (trimmed, synthetic values).
const ring:[number,number][]=[[608400,466900],[608440,466900],[608440,466940],[608400,466940]];
const member=(id:string,price:number,ha:number,date:string,kind='nieruchomoscGruntowaNiezabudowana',purpose='terenZabudowyMieszkaniowej')=>`<wfs:member><ms:dzialki><ms:TRAN_OZNACZENIE_TRANS>${id}</ms:TRAN_OZNACZENIE_TRANS><ms:TRAN_RODZAJ_TRANS>wolnyRynek</ms:TRAN_RODZAJ_TRANS><ms:TRAN_CENA_BRUTTO>${price}</ms:TRAN_CENA_BRUTTO><ms:DOK_DATA gml:id="x"><gml:timePosition>${date}T00:00:00Z</gml:timePosition></ms:DOK_DATA><ms:NIER_RODZAJ>${kind}</ms:NIER_RODZAJ><ms:NIER_POW_GRUNTU>${ha}</ms:NIER_POW_GRUNTU><ms:DZI_PRZEZN_WMPZP>${purpose}</ms:DZI_PRZEZN_WMPZP><ms:DZI_ADRES>MSC:Makówka</ms:DZI_ADRES></ms:dzialki></wfs:member>`;

test('RCN keeps one recent unbuilt-land sale per transaction and prices the parcel at the median',()=>{
  const now=Date.parse('2026-11-23');
  const xml=member('a',300000,0.12,'2025-05-01')+member('a',300000,0.12,'2025-05-01')+member('b',400000,0.16,'2026-01-10')+member('c',260000,0.1,'2024-03-02')+member('old',1,0.1,'2018-01-01')+member('built',900000,0.1,'2025-01-01','nieruchomoscGruntowaZabudowana');
  const sales=readRcn(xml,now);
  assert.deepEqual(sales.map(s=>s.perM2),[250,250,260]);
  assert.equal(sales[0].place,'Makówka');
  const p=priceSummary(sales,1500,1500);
  assert.equal(p.median,250);assert.equal(p.estimate,375000);assert.equal(p.buildingOnly,true);
  assert.equal(priceSummary([],1500,1500).status,'none');
});

test('OpenStreetMap features are measured to the parcel and classified',()=>{
  const at=(e:number,n:number)=>{const[lon,lat]=geographicPoint([e,n]);return{lat,lon};};
  const osm=readOsm([
    {type:'way',tags:{highway:'track',name:'Polna'},geometry:[at(608380,466880),at(608380,466960)]},
    {type:'way',tags:{highway:'residential',surface:'asphalt',name:'Orzechowa'},geometry:[at(608300,466800),at(608300,467000)]},
    {type:'node',tags:{highway:'bus_stop',name:'Makówka'},...at(608440,467400)},
    {type:'way',tags:{power:'line',voltage:'110000'},geometry:[at(608500,466800),at(608500,467000)]},
    {type:'way',tags:{landuse:'industrial'},geometry:[at(609000,466900),at(609100,466900)]},
    {type:'count',tags:{ways:'12'}},
  ],ring);
  assert.equal(osm.road?.name,'Polna');assert.equal(osm.road?.distance,20);assert.equal(osm.road?.detail,'nieutwardzona');
  assert.equal(osm.busStop?.distance,460);
  assert.deepEqual(osm.powerLines.map(p=>[p.kind,p.distance]),[['linia WN',60]]);
  assert.equal(osm.nuisance[0].kind,'teren przemysłowy');assert.equal(osm.buildings200,12);
});

test('distances are zero inside the parcel and null for an empty network image',()=>{
  assert.equal(distanceToParcel(ring,[[608420,466920]]),0);
  assert.equal(distanceToParcel(ring,[[608450,466920]]),10);
  assert.equal(pointsToParcel(ring,[[608460,466920],[608445,466950]]),11);
  assert.equal(pointsToParcel(ring,[]),null);
});

test('Otodom and OLX listings are read from their embedded page state',()=>{
  const otodom=`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:{data:{searchAds:{items:[{title:'Działka 1500 m²',slug:'dzialka-ID1',totalPrice:{value:395000},areaInSquareMeters:1500,pricePerSquareMeter:{value:263.33}}]}}}}})}</script>`;
  assert.deepEqual(readOtodom(otodom),[{source:'Otodom',title:'Działka 1500 m²',url:'https://www.otodom.pl/pl/oferta/dzialka-ID1',price:395000,area:1500,perM2:263,place:undefined}]);
  const state=JSON.stringify({listing:{listing:{ads:[{title:'Działka budowlana',url:'https://www.olx.pl/d/oferta/x.html',price:{regularPrice:{value:549000}},params:[{key:'m',normalizedValue:'1823'}],location:{cityName:'Urzut'},map:{lat:52.07,lon:20.74}},{title:'Elsewhere',url:'https://evil.example/'}]}}});
  const olx=readOlx(`<script>window.__PRERENDERED_STATE__= ${JSON.stringify(state)};</script>`);
  assert.equal(olx.length,1);assert.equal(olx[0].perM2,301);assert.ok(olx[0].at);
  assert.deepEqual(readOtodom('<html></html>'),[]);
  assert.equal(slug('powiat grodziski'),'grodziski');assert.equal(slug('Łódź Bałuty'),'lodz-baluty');
});

test('insights requests accept only a parcel ring in Poland',()=>{
  assert.deepEqual(parseInsightsQuery({point:[608420,466920],ring,area:1600}).area,1600);
  assert.throws(()=>parseInsightsQuery({point:[1,2],ring,area:1600}));
  assert.throws(()=>parseInsightsQuery({point:[608420,466920],ring:ring.slice(0,2),area:1600}));
  assert.throws(()=>parseInsightsQuery({point:[608420,466920],ring:[[608420,466920],[612000,466920],[612000,470000]],area:1600}));
  assert.throws(()=>parseInsightsQuery(null));
});

test('soil classes decide conversion fees',()=>{
  assert.deepEqual(soilClasses('ŁVI, PsV'),{classes:['ŁVI','PsV'],valuable:false,forest:false,built:false});
  assert.equal(soilClasses('RIIIa').valuable,true);
  assert.equal(soilClasses('B').built,true);
  assert.equal(soilClasses('Ls').forest,true);
});

test('the report opens with a summary, lists risks and prices, and gives no buying verdict',()=>{
  const scene=parseScene({schemaVersion:2,units:'m',coordinates:{crs:'LOCAL',axis:'x-east-y-south',projected:{crs:'EPSG:2180',origin:{x:608400,y:466940}}},plot:[{x:0,y:0},{x:40,y:0},{x:40,y:40},{x:0,y:40}],items:[]});
  const empty={status:'none' as const,features:[]};
  const site={retrievedAt:'2026-11-23T00:00:00Z',bbox:[608350,466850,608490,466990] as [number,number,number,number],point:[608420,466920] as [number,number],size:512,ortho:{captures:[]},
    layers:{cadastre:{status:'found' as const,features:[{attrs:{'Oznaczenie konturu':'ŁVI'}}]},planning:{status:'found' as const,features:[{attrs:{fun_symb:'MN'}}]},utilities:{status:'found' as const,features:[{attrs:{rodzaj:'elektroenergetyczna'}}]},environment:empty,flood:empty,groundwater:empty,landslides:empty,mining:empty,wells:empty,heritage:empty},
    networkDistances:{power:4,water:null,sewer:null,gas:180},
    insights:{retrievedAt:'2026-11-23T00:00:00Z',admin:{voivodeship:'mazowieckie',county:'powiat grodziski',commune:'Grodzisk Mazowiecki',region:'Makówka'},osm:{status:'ok' as const,road:{name:'Polna',kind:'droga gruntowa',distance:4,detail:'nieutwardzona'},powerLines:[],nuisance:[]},drives:[{name:'Grodzisk Mazowiecki',kind:'miasteczko',distance:9000,km:9.4,minutes:13}],
      prices:{status:'ok' as const,radius:1500,count:3,median:250,q1:240,q3:260,estimate:400000,buildingOnly:true,sales:[{date:'2025-05-01',price:300000,area:1200,perM2:250}]},
      listings:{status:'ok' as const,searched:[],items:[{source:'OLX' as const,title:'Działka <b>1600</b>',url:'https://www.olx.pl/d/oferta/x.html',price:400000,area:1600,perM2:250,distance:300}],match:{source:'OLX' as const,title:'Działka <b>1600</b>',url:'https://www.olx.pl/d/oferta/x.html',price:400000,area:1600,distance:300}}}};
  const html=projectReport(scene,'pl','2026-11-23T00:00:00Z',{site});
  assert.ok(html.indexOf('Podsumowanie')<html.indexOf('Ryzyka do sprawdzenia'));
  for(const text of ['Brak wodociągu','Brak kanalizacji','Nieutwardzona droga dojazdowa','250 zł/m²','400\u00a0000 zł','Ta działka może być wystawiona na sprzedaż','13 min do: Grodzisk Mazowiecki','Księga wieczysta','bez opłat (kl. IV–VI)'])assert.ok(html.includes(text),text);
  assert.ok(!html.includes('tys. zł'),'no invented cost ranges');
  assert.ok(!html.includes('<b>1600</b>'));
  assert.ok(!/warto kupi|worth buying|\/ ?100/i.test(html));
  const en=projectReport(scene,'en','2026-11-23T00:00:00Z',{site});
  assert.ok(en.includes('Summary')&&en.includes('No water main nearby'));
});

test('vector tiles stand in for Overpass: roads, land use and a building count',async()=>{
  const {readFileSync}=await import('node:fs');
  const k=2**14,lon=(9153.5)/k*360-180,lat=Math.atan(Math.sinh(Math.PI*(1-2*5386.5/k)))*180/Math.PI,c=projectPoint([lon,lat]);
  const elements=await tileElements([{buffer:new Uint8Array(readFileSync(new URL('./fixtures/versatiles-14-9153-5386.pbf',import.meta.url))),x:9153,y:5386}],c);
  const box:[number,number][]=[[c[0]-5,c[1]-5],[c[0]+5,c[1]-5],[c[0]+5,c[1]+5],[c[0]-5,c[1]+5]],osm=readOsm(elements,box);
  assert.ok(osm.road&&osm.road.distance<300);
  assert.equal(elements.at(-1)?.type,'count');
});
test('report risks carry no invented cost estimates',async()=>{
  const src=(await import('node:fs')).readFileSync(new URL('../public/core/report-insights.ts',import.meta.url),'utf8');
  assert.doesNotMatch(src,/tys\. zł|thousand zł|\* 300|levellingCost/);
});
test('road numbers give the category and the art. 43 distances; unnumbered roads stay unknown',async()=>{
  const {roadCategory,roadSetback}=await import('../public/core/site-insights.ts');
  assert.deepEqual(['A2','S8','92','DK92','579','4105W','410102W','',undefined,'92;579','12345'].map(roadCategory),['autostrada','ekspresowa','krajowa','krajowa','wojewódzka','powiatowa','gminna',undefined,undefined,'krajowa',undefined]);
  assert.deepEqual(roadSetback.gminna,[6,15]);assert.deepEqual(roadSetback.powiatowa,[8,20]);
});
test('PVGIS, GIOŚ and GUS answers are read as given and refuse empty answers',async()=>{
  const {readPvgis,nearestStation,readAqIndex,readBdl}=await import('../public/core/site-insights.ts');
  const {projectPoint}=await import('../public/core/geospatial.ts');
  assert.deepEqual(readPvgis({inputs:{meteo_data:{radiation_db:'PVGIS-SARAH3',year_min:2005,year_max:2023},mounting_system:{fixed:{slope:{value:39},azimuth:{value:-2}}}},outputs:{totals:{fixed:{E_y:1063.42}}}}),{kwhPerKwp:1063,angle:39,azimuth:-2,database:'PVGIS-SARAH3',years:'2005–2023'});
  assert.throws(()=>readPvgis({outputs:{totals:{fixed:{}}}}));
  const here=projectPoint([20.6175,52.1985]),stations=[{'Identyfikator stacji':466,'Nazwa stacji':'Granica, KPN','WGS84 φ N':'52.285858','WGS84 λ E':'20.454653'},{'Identyfikator stacji':488,'Nazwa stacji':'Piastów, ul. Pułaskiego','WGS84 φ N':'52.191728','WGS84 λ E':'20.837489'}];
  const s=nearestStation(stations,here)!;assert.equal(s.id,466);assert.ok(s.distance>14000&&s.distance<16000,String(s.distance));
  assert.deepEqual(readAqIndex({AqIndex:{'Nazwa kategorii indeksu':'Bardzo dobry','Data wykonania obliczeń indeksu':'2026-11-28 12:35:21'}},s),{station:'Granica, KPN',distance:s.distance,index:'Bardzo dobry',at:'2026-11-28 12:35:21'});
  assert.throws(()=>readAqIndex({AqIndex:{'Nazwa kategorii indeksu':null}},s));
  const bdl=readBdl({results:[{id:'72305',values:[{year:'2024',val:22510},{year:'2025',val:22680}]},{id:'747069',values:[{year:'2025',val:36.7}]}]},'Błonie');
  assert.deepEqual(bdl,{unit:'Błonie',population:[{year:'2024',val:22510},{year:'2025',val:22680}],dwellings:[],migration:[],buildMonths:[{year:'2025',val:36.7}]});
  assert.throws(()=>readBdl({results:[]},'X'));
});
test('OpenStreetMap gives the road number and the nearest everyday places',()=>{
  const ring:[number,number][]=[[500000,500000],[500020,500000],[500020,500020],[500000,500020]];
  const ll=(e:number,n:number)=>{const [lon,lat]=geo([e,n]);return {lat,lon};};
  const osm=readOsm([
    {type:'way',tags:{highway:'tertiary',name:'Lesznowska',ref:'4105W'},geometry:[ll(500030,499990),ll(500030,500040)]},
    {type:'node',tags:{amenity:'school',name:'SP 1'},...ll(500300,500010)},
    {type:'node',tags:{amenity:'school',name:'SP 2'},...ll(501000,500010)},
    {type:'node',tags:{shop:'convenience'},...ll(500120,500010)},
  ],ring);
  assert.equal(osm.road?.ref,'4105W');
  assert.deepEqual(osm.amenities?.map(a=>[a.kind,a.name]),[['szkoła','SP 1'],['sklep spożywczy',undefined]]);
});
