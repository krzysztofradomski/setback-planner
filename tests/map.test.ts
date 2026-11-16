import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectOverlay } from '../public/map/overlay.ts';
import { mapSources, mapOverlayIds, isMapOverlay, sourceDirectory } from '../public/map/sources.ts';
import { parseScene } from '../public/core/scene.ts';
import { projectPoint } from '../public/core/geospatial.ts';
test('map overlay closes parcel/building rings and preserves metric coordinates',()=>{
  const scene=parseScene({plot:[{x:0,y:0},{x:30,y:0},{x:30,y:40},{x:0,y:40}],items:[{id:'a',type:'house',name:'House',x:15,y:20,w:10,d:8}]});
  assert.equal(projectOverlay(scene).features.length,0);
  scene.coordinates.projected={crs:'EPSG:2180',origin:{x:500000,y:500000}};
  const features=projectOverlay(scene).features;assert.equal(features.length,2);
  const ring=features[0].geometry.coordinates[0];assert.deepEqual(ring[0],ring.at(-1));
  const projected=projectPoint(ring[2] as [number,number]);assert.ok(Math.abs(projected[0]-500030)<1e-4);assert.ok(Math.abs(projected[1]-499960)<1e-4);
});
test('map sources are attributed HTTPS services with explicit WMS axis order',()=>{
  for(const source of Object.values(mapSources)){assert.ok(source.attribution);assert.ok(source.tiles.every(s=>s.startsWith('https://')));}
  for(const source of [mapSources.ortho,mapSources.cadastre]){assert.ok(source.tiles[0].includes('SRS=EPSG:3857'));assert.ok(source.tiles[0].includes('VERSION=1.1.1'));}
});

test('official context overlays use verified provider layers and are valid selectable overlays',()=>{
  const expected={flood:['NZ.Fluvial','NZ.RiskZone','NZ.ExposedElement_q10','NZ.ExposedElement_q1','NZ.ExposedElement_q0_2'],groundwater:['0'],relief:['Raster'],planning:['raster','wektor-str','wektor-pow','wektor-lzb','wektor-lin','wektor-pkt','granice']};
  for(const [id,layers]of Object.entries(expected)){
    assert.ok(isMapOverlay(id));
    const url=new URL(mapSources[id as keyof typeof expected].tiles[0]);
    assert.deepEqual(url.searchParams.get('LAYERS')?.split(','),layers);
    assert.equal(url.searchParams.get('SRS'),'EPSG:3857');
    assert.equal(url.searchParams.get('VERSION'),'1.1.1');
    assert.equal(url.searchParams.get('BBOX'),'{bbox-epsg-3857}');
  }
  assert.equal(isMapOverlay('osm'),false);assert.equal(isMapOverlay('__proto__'),false);
  for(const id of mapOverlayIds)assert.ok(sourceDirectory.find(source=>source.id===id&&source.status==='Available'));
  assert.equal(sourceDirectory.find(source=>source.id==='prices')?.status,'External reference');
});
