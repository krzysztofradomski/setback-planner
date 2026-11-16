import Clipper from 'clipper-lib';
import {parcelPolygons,parcelContains,type ParcelTopology} from './topology.ts';
import {signedArea,pointLocation,polygonRelation,type Point} from './geometry.ts';
import {worldFootprint} from './footprints.ts';
import{blocksPlacement}from'./objects.ts';
import type{Scene,SceneItem}from'./scene.ts';
export function setbackArea(scene:ParcelTopology,distance:number){
 if(!Number.isFinite(distance)||distance<0||distance>1000)throw new Error('Invalid setback');
 const input=parcelPolygons(scene).flatMap(part=>part.map((ring,i)=>{const ordered=(signedArea(ring)>0)===(i===0)?ring:[...ring].reverse();return ordered.map(p=>({X:Math.round(p.x*1000),Y:Math.round(p.y*1000)}));}));
 const offset=new Clipper.ClipperOffset(2,.25);offset.AddPaths(input,Clipper.JoinType.jtMiter,Clipper.EndType.etClosedPolygon);const paths:Clipper.Paths=[];offset.Execute(paths,-distance*1000);
 const rings=paths.map(path=>path.map(p=>({x:p.X/1000,y:p.Y/1000}))),outers=rings.filter(r=>signedArea(r)>0),holes=rings.filter(r=>signedArea(r)<0);
 const parts=outers.map(outer=>[outer,...holes.filter(h=>pointLocation(h[0],outer)==='inside')]);
 return {parts,area:Math.max(0,rings.reduce((n,r)=>n+signedArea(r),0))};
}
export function suggestPlacements(scene:Scene,item:SceneItem){
 const area=setbackArea(scene,item.setback),others=scene.items.filter(i=>i.id!==item.id&&blocksPlacement(i));
 const all=parcelPolygons(scene).flat(2),xs=all.map(p=>p.x),ys=all.map(p=>p.y),minX=Math.min(...xs),minY=Math.min(...ys),maxX=Math.max(...xs),maxY=Math.max(...ys),found:{x:number;y:number;rot:number;score:number}[]=[];
 const feasible=(candidate:SceneItem)=>{const ring=worldFootprint(candidate);return area.parts.some(([outer,...holes])=>parcelContains({plot:outer,plotHoles:holes},ring))&&!others.some(o=>polygonRelation(ring,worldFootprint(o))!=='disjoint');};
 const points:Point[]=[{x:item.x,y:item.y}];for(let row=0;row<=20;row++)for(let col=0;col<=20;col++)points.push({x:minX+(maxX-minX)*col/20,y:minY+(maxY-minY)*row/20});
 for(const rot of new Set([item.rot,0,90]))for(const p of points)if(feasible({...item,...p,rot}))found.push({...p,rot,score:Math.hypot(p.x-item.x,p.y-item.y)+Math.abs(rot-item.rot)*.01});
 found.sort((a,b)=>a.score-b.score||a.x-b.x||a.y-b.y||a.rot-b.rot);return {...area,suggestions:found.slice(0,8)};
}
