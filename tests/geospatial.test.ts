import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importParcel, projectPoint, geographicPoint } from '../public/core/geospatial.ts';
import { polygonArea } from '../public/core/geometry.ts';
const polygon={type:'Polygon',coordinates:[[[500000,500000],[500020,500000],[500020,500010],[500010,500010],[500010,500030],[500000,500030],[500000,500000]]]};
test('imports arbitrary parcel rings into metric south-positive coordinates with reversible CRS origin',()=>{
  const parcel=importParcel(polygon,'EPSG:2180','fixture.geojson','2026-11-16T12:00:00Z');
  assert.equal(parcel.plot.length,6);assert.ok(Math.abs(polygonArea(parcel.plot)-400)<1e-8);
  assert.deepEqual(parcel.coordinates.projected?.origin,{x:500000,y:500000});
  assert.ok(parcel.plot.some(p=>p.x===20&&p.y===-10));
  assert.equal(parcel.parcel.source.name,'fixture.geojson');
});
test('projection matches the central meridian and round-trips Polish coordinate samples',()=>{
  assert.ok(Math.abs(projectPoint([19,52])[0]-500000)<1e-6);
  for(const source of [[21.0122,52.2297],[19,52],[14.6,53.4],[22.5,49.5]] as [number,number][]){
    const result=geographicPoint(projectPoint(source));
    assert.ok(Math.abs(result[0]-source[0])<1e-7);assert.ok(Math.abs(result[1]-source[1])<1e-7);
  }
});
test('rejects invalid holes, overlapping parts, unclosed rings and ambiguous CRS',()=>{
  assert.throws(()=>importParcel({...polygon,coordinates:[...polygon.coordinates,polygon.coordinates[0]]},'EPSG:2180','fixture','2026-11-16T12:00:00Z'));
  assert.throws(()=>importParcel({type:'MultiPolygon',coordinates:[polygon.coordinates,polygon.coordinates]},'EPSG:2180','fixture','2026-11-16T12:00:00Z'));
  assert.throws(()=>importParcel({type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1]]]},'EPSG:4326','fixture','2026-11-16T12:00:00Z'));
  assert.throws(()=>importParcel({...polygon,crs:{name:'unknown'}},'EPSG:2180','fixture','2026-11-16T12:00:00Z'));
});
