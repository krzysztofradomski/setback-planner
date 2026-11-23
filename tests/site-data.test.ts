import{test}from'node:test';import assert from'node:assert/strict';
import{parseFeatureInfo,layerStatus,parseOrthoCaptures,parseSiteQuery,siteFrame,sitePixel,fetchSiteData}from'../public/core/site-data.ts';
import{parseScene}from'../public/core/scene.ts';
// Response shapes captured from the live services on 2026-11-17 (trimmed).
test('GeoServer JSON keeps names and drops geometry',()=>{
  const r=parseFeatureInfo('{"type":"FeatureCollection","features":[{"type":"Feature","id":"ParkiNarodowe.fid-1","geometry":{"type":"MultiPolygon","coordinates":[]},"properties":{"nazwa":"Kampinoski Park Narodowy","kodinspire":"PL.ZIPOP.1393.PN.9","objectid":7}}]}');
  assert.deepEqual(r.features,[{layer:'ParkiNarodowe',attrs:{nazwa:'Kampinoski Park Narodowy',kodinspire:'PL.ZIPOP.1393.PN.9'}}]);
  assert.equal(layerStatus(r),'found');
  assert.equal(layerStatus(parseFeatureInfo('{"type":"FeatureCollection","features":[]}')),'none');
});
test('ESRI XML, GeoMedia GML, Oracle ROWSET and HTML tables are normalised',()=>{
  const esri=parseFeatureInfo('<?xml version="1.0"?><FeatureInfoResponse xmlns="http://www.esri.com/wms"><FIELDS OBJECTID="3" Nazwawarstwy="Podtopienia" Opisobszaru="Obszary zagrożone powodzią od wód gruntowych" Shape="Polygon"/></FeatureInfoResponse>');
  assert.deepEqual(esri.features[0].attrs,{Nazwawarstwy:'Podtopienia',Opisobszaru:'Obszary zagrożone powodzią od wód gruntowych'});
  assert.equal(layerStatus(parseFeatureInfo('<?xml version="1.0"?><FeatureInfoResponse xmlns="http://www.esri.com/wms"></FeatureInfoResponse>')),'none');
  const gml=parseFeatureInfo('<?xml version="1.0"?><FeatureCollection><gml:featureMember><Layer Name="integracja"><Attribute Name="Identyfikator działki">143402_1.0031.77</Attribute><Attribute Name="Oznaczenie konturu">B, Bi</Attribute><Attribute Name="Kod QR"><![CDATA[<img src="x">]]></Attribute></Layer></gml:featureMember></FeatureCollection>');
  assert.deepEqual(gml.features,[{layer:'integracja',attrs:{'Identyfikator działki':'143402_1.0031.77','Oznaczenie konturu':'B, Bi'}}]);
  const rows=parseFeatureInfo('<?xml version="1.0" encoding="UTF-8"?><GetFeatureInfo_Result><ROWSET name="MPZP_PRZEZNACZENIE_TERENU"><ROW num="1"><MAX_WYS> </MAX_WYS><FUN_NAZWA>droga dojazdowa</FUN_NAZWA><FUN_SYMB>197 KD-D</FUN_SYMB><NAZWA_PLAN>Miasto–Ogród Sadyba cz.I</NAZWA_PLAN></ROW></ROWSET></GetFeatureInfo_Result>');
  assert.deepEqual(rows.features[0],{layer:'MPZP_PRZEZNACZENIE_TERENU',attrs:{FUN_NAZWA:'droga dojazdowa',FUN_SYMB:'197 KD-D',NAZWA_PLAN:'Miasto–Ogród Sadyba cz.I'}});
  const html=parseFeatureInfo("<html><body><h5>FeatureInfoCollection - layer name: 'Przeznaczenia MPZP'</h5><table><tbody><tr><th>gdb_id</th><th>Oznaczenie</th><th>Nazwa MPZP</th></tr><tr><td>9</td><td>MN.1</td><td>Plan Bronowice</td></tr></tbody></table></body></html>");
  assert.deepEqual(html.features,[{layer:'Przeznaczenia MPZP',attrs:{Oznaczenie:'MN.1','Nazwa MPZP':'Plan Bronowice'}}]);
});
test('plain messages separate missing data from a municipality without a service',()=>{
  assert.equal(layerStatus(parseFeatureInfo('m. Marki: brak wyniku dla wskazanego obszaru')),'none');
  assert.equal(layerStatus(parseFeatureInfo('brak serwisu dla wskazanego obszaru')),'unavailable');
  assert.equal(layerStatus(parseFeatureInfo('<ServiceExceptionReport><ServiceException code="InvalidFormat">Invalid format</ServiceException></ServiceExceptionReport>')),'error');
});
test('orthophoto capture dates come newest first from single-line records',()=>{
  const body='@Raster objectid;name;aktualnosc;projekt;seria;czy_ark_wy; 1;SENTINEL;Null;Null;Null;Null; 2;N-34;23.04.2020;LPIS2020_OB2;Null;TAK; 3;N-34;19.06.2022;LPIS2022_OB1;ORTO_025_RGB_2022;TAK;';
  assert.deepEqual(parseOrthoCaptures(body),[{date:'2022-06-19',series:'ORTO_025_RGB_2022'},{date:'2020-04-23',series:'LPIS2020_OB2'}]);
});
test('site frame is square around a located parcel and requests are validated',()=>{
  const scene=parseScene({schemaVersion:2,units:'m',coordinates:{crs:'LOCAL',axis:'x-east-y-south',projected:{crs:'EPSG:2180',origin:{x:643400,y:497800}}},plot:[{x:0,y:0},{x:40,y:0},{x:40,y:30},{x:0,y:30}],items:[]});
  const f=siteFrame(scene)!;
  assert.equal(f.bbox[2]-f.bbox[0],f.bbox[3]-f.bbox[1]);
  assert.deepEqual(f.point,[643420,497785]);
  assert.deepEqual(parseSiteQuery(new URLSearchParams(f.query)),{bbox:f.bbox,point:f.point});
  const [x,y]=sitePixel({bbox:f.bbox,size:512},...f.point);assert.ok(Math.abs(x-256)<1&&Math.abs(y-256)<1);
  assert.throws(()=>parseSiteQuery(new URLSearchParams('bbox=0,0,10,10&x=5&y=5')));
  assert.throws(()=>parseSiteQuery(new URLSearchParams('bbox=600000,400000,610000,410000&x=605000&y=405000')),'frames over 4 km are refused');
  assert.equal(siteFrame(parseScene({...scene,coordinates:{crs:'LOCAL',axis:'x-east-y-south'}})),null);
});
test('each source fails independently and redirects off gov.pl are refused',async()=>{
  const fetcher=(async(url:string)=>{
    if(url.includes('sdi.gdos.gov.pl'))throw new Error('down');
    if(url.includes('REQUEST=GetMap'))return new Response(new Uint8Array([137,80,78,71]),{headers:{'content-type':'image/png'}});
    if(url.includes('isok'))return Object.defineProperty(new Response('{}'),'url',{value:'https://evil.example/'});
    if(url.includes('KrajowaIntegracjaUzbrojeniaTerenu')&&url.includes('REQUEST=GetMap'))return Object.defineProperty(new Response(new Uint8Array([137,80,78,71]),{headers:{'content-type':'image/png'}}),'url',{value:'https://wms.um.warszawa.pl/serwis'});
    return new Response('{"type":"FeatureCollection","features":[{"properties":{"nazwa":"X"}}]}');
  }) as unknown as typeof fetch;
  const d=await fetchSiteData({bbox:[643300,497600,643500,497800],point:[643400,497700]},fetcher);
  assert.equal(d.layers.environment.status,'error');
  assert.equal(d.layers.flood.status,'error');
  assert.equal(d.layers.wells.status,'found');
  assert.match(d.layers.wells.image!,/^data:image\/png;base64,/);
  // GUGiK's county relay may forward to the county's own server; those images are kept.
  assert.match(d.layers.utilities.image!,/^data:image\/png;base64,/);
  assert.deepEqual(Object.keys(d.networks!.images).sort(),['gas','power','sewer','water']);
});
test('plan building lines: distance from each parcel edge, snapped to the half metres plans use',async()=>{
  const {buildingLineSetbacks}=await import('../public/core/site-data.ts');
  const plot=[{x:0,y:0},{x:30,y:0},{x:30,y:30},{x:0,y:30}],inside=(p:{x:number;y:number})=>p.x>=0&&p.x<=30&&p.y>=0&&p.y<=30;
  // A line 5.9 m inside the first edge (y=0), drawn as one pixel row every 0.2 m, plus a few marker pixels.
  const points=[...Array.from({length:150},(_,i)=>({x:i*0.2,y:5.9})),{x:3,y:6.3},{x:9,y:6.3},{x:15,y:6.4}];
  assert.deepEqual(buildingLineSetbacks(plot,points,0.2,inside),[6,null,null,null]);
});
test('Web Mercator round trip stays within millimetres in Poland',async()=>{
  const {toMercator,fromMercator}=await import('../public/core/site-data.ts');
  const p:[number,number]=[610933.41,481494.53],[e,n]=fromMercator(toMercator(p));
  assert.ok(Math.abs(e-p[0])<0.01&&Math.abs(n-p[1])<0.01);
});
