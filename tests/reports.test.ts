import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectSvg, projectReport } from '../public/core/reports.ts';
import { parseScene } from '../public/core/scene.ts';
const scene=()=>parseScene({plot:[{x:0,y:0},{x:30,y:0},{x:30,y:40},{x:0,y:40}],items:[{id:'a',type:'house',name:'<img src=x onerror=alert(1)>',x:15,y:20,w:10,d:8,shape:'L',appearance:{facade:'brick-red'}}]});
test('SVG export is metric, view-independent and escapes all user text',()=>{
  const svg=projectSvg(scene(),'en');assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('&lt;img'));assert.ok(!svg.includes('<img'));assert.ok(!svg.includes('<script'));assert.ok(svg.includes('polygon'));
});
test('report uses actual footprint area, preserves sources and distinguishes unknown requirements',()=>{
  const project=scene();project.parcel={identifier:'test',source:{name:'GUGiK ULDK',url:'https://uldk.gugik.gov.pl/',retrievedAt:'2026-11-16T12:00:00Z',crs:'EPSG:2180'},edited:true};
  const report=projectReport(project,'en','2026-11-16T12:30:00Z');
  assert.ok(report.includes('40.80'));assert.ok(report.includes('GUGiK ULDK'));assert.ok(report.includes('2026-11-16T12:00:00Z'));
  assert.ok(report.includes('Unverified requirements'));assert.ok(report.includes('No verified manufacturer price'));assert.ok(report.includes('edited'));
  assert.ok(!report.includes('<img src=x'));assert.ok(report.includes('Dark red brick slips'));
});
test('reports exclude landscaping from building coverage and hide invisible SVG objects',()=>{
 const project=scene();project.items.push({...structuredClone(project.items[0]),id:'garden',name:'Garden marker',type:'landscape',kind:'lawn',w:5,d:5,shape:'rectangle',visible:false});
 assert.ok(projectReport(project).includes('40.80 m²'));
 assert.ok(!projectSvg(project).includes('Garden marker'));
});
test('report verdict, buildable zone and neighbour distances are deterministic geometry',async()=>{
  const {polygonDistance}=await import('../public/core/reports.ts');
  const ok=parseScene({plot:[{x:0,y:0},{x:30,y:0},{x:30,y:40},{x:0,y:40}],items:[{id:'a',type:'house',name:'H',x:15,y:20,w:10,d:8,setback:4}]});
  const neighbour={ring:[{x:35,y:16},{x:45,y:16},{x:45,y:24},{x:35,y:24}],height:6.5,heightSource:'default' as const,kind:'building',onParcel:false};
  const report=projectReport(ok,'en','2026-11-16T12:30:00Z',{neighbours:[neighbour]});
  assert.ok(report.includes('The layout meets the setbacks you selected'));
  assert.ok(report.includes('Nearest neighbouring building')&&report.includes('15.0 m'),'house edge x=20 to neighbour x=35');
  assert.ok(report.includes('Check in official sources')&&report.includes('isok.gov.pl'));
  assert.equal(polygonDistance([{x:0,y:0},{x:1,y:0},{x:1,y:1}],[{x:3,y:0},{x:4,y:0},{x:4,y:1}]),2);
  const bad=parseScene({...ok,items:[{...ok.items[0],x:3}]});
  assert.ok(projectReport(bad,'pl').includes('1 budynek wymaga uwagi'));
});
