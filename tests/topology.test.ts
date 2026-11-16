import{test}from'node:test';import assert from'node:assert/strict';import{importParcel}from'../public/core/geospatial.ts';import{parcelArea,parcelContains}from'../public/core/topology.ts';
const ring=(x:number,y:number,w:number)=>[[x,y],[x+w,y],[x+w,y+w],[x,y+w],[x,y]];
test('multipart imports preserve holes and parts and exclude holes from placement/area',()=>{
const p=importParcel({type:'MultiPolygon',coordinates:[[ring(500000,500000,20),ring(500005,500005,5)],[ring(500040,500000,10)]]},'EPSG:2180','fixture','2026-11-16T12:00:00Z');assert.equal(p.plotParts.length,1);assert.equal(p.plotHoles.length,1);assert.equal(parcelArea(p),475);assert.equal(parcelContains(p,[{x:6,y:-6},{x:8,y:-6},{x:8,y:-8},{x:6,y:-8}]),false);assert.equal(parcelContains(p,[{x:42,y:-2},{x:44,y:-2},{x:44,y:-4},{x:42,y:-4}]),true);
});
