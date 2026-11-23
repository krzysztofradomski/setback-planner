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
/** Members of a group follow their leader rigidly: same offset and turn as the leader moves to `pose`. */
export function moveWith(leader:SceneItem,members:SceneItem[],pose:{x:number;y:number;rot:number}):SceneItem[]{
 const turn=(pose.rot-leader.rot)*Math.PI/180,c=Math.cos(turn),s=Math.sin(turn);
 return members.map(m=>{const dx=m.x-leader.x,dy=m.y-leader.y;return {...m,x:pose.x+dx*c-dy*s,y:pose.y+dx*s+dy*c,rot:m.rot+pose.rot-leader.rot};});
}
/** Free poses for `item` (with `members` moving along), each piece inside the parcel shrunk by its own setback and clear of other objects. */
export function suggestPlacements(scene:Scene,item:SceneItem,members:SceneItem[]=[]){
 const moving=new Set([item.id,...members.map(m=>m.id)]),areas=new Map<number,ReturnType<typeof setbackArea>>();
 const areaFor=(d:number)=>{if(!areas.has(d))areas.set(d,setbackArea(scene,d));return areas.get(d)!;};
 const area=areaFor(item.setback),others=scene.items.filter(i=>!moving.has(i.id)&&blocksPlacement(i)).map(worldFootprint);
 const all=parcelPolygons(scene).flat(2),xs=all.map(p=>p.x),ys=all.map(p=>p.y),minX=Math.min(...xs),minY=Math.min(...ys),maxX=Math.max(...xs),maxY=Math.max(...ys),found:{x:number;y:number;rot:number;score:number}[]=[];
 const fits=(piece:SceneItem)=>{const ring=worldFootprint(piece);return areaFor(piece.setback).parts.some(([outer,...holes])=>parcelContains({plot:outer,plotHoles:holes},ring))&&(!blocksPlacement(piece)||!others.some(o=>polygonRelation(ring,o)!=='disjoint'));};
 const feasible=(candidate:SceneItem)=>fits(candidate)&&moveWith(item,members,candidate).every(fits);
 const points:Point[]=[{x:item.x,y:item.y}];for(let row=0;row<=20;row++)for(let col=0;col<=20;col++)points.push({x:minX+(maxX-minX)*col/20,y:minY+(maxY-minY)*row/20});
 for(const rot of new Set([item.rot,item.rot+90,0,90]))for(const p of points)if(feasible({...item,...p,rot}))found.push({...p,rot,score:Math.hypot(p.x-item.x,p.y-item.y)+Math.abs(rot-item.rot)*.01});
 found.sort((a,b)=>a.score-b.score||a.x-b.x||a.y-b.y||a.rot-b.rot);return {...area,suggestions:found.slice(0,8)};
}
/** Direction of the parcel's longest edge in degrees, folded to (-45,45] (a rectangle turned 90° is the same alignment). */
export function parcelAxis(ring:Point[]){
 let angle=0,longest=-1;
 ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length],len=Math.hypot(b.x-a.x,b.y-a.y);if(len>longest){longest=len;angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;}});
 return Math.round((((angle%90)+135)%90-45)*10)/10;
}
/** Re-seat unlocked items on a newly chosen parcel: align with its longest edge, then take the free spot nearest its centre (largest first). */
export function fitItemsToParcel(scene:Scene):SceneItem[]{
 const ring=scene.plot,angle=parcelAxis(ring);
 const cx=ring.reduce((n,p)=>n+p.x,0)/ring.length,cy=ring.reduce((n,p)=>n+p.y,0)/ring.length;
 const placed=new Map<string,SceneItem>(scene.items.filter(i=>i.locked).map(i=>[i.id,i]));
 for(const item of scene.items.filter(i=>!i.locked).sort((a,b)=>b.w*b.d-a.w*a.d||a.id.localeCompare(b.id))){
  if(placed.has(item.id))continue;// moved with its group leader
  const members=item.group?scene.items.filter(i=>i.group===item.group&&!i.locked):[item];
  const start={...item,x:cx,y:cy,rot:angle},others=members.filter(m=>m.id!==item.id),moved=moveWith(item,others,start);
  const best=suggestPlacements({...scene,items:[...placed.values(),start,...moved]},start,moved).suggestions[0];
  const pose=best?{x:best.x,y:best.y,rot:best.rot}:start;// ponytail: no free spot -> centre; the layout review flags it
  for(const m of moveWith(item,members,pose))placed.set(m.id,m);
 }
 return scene.items.map(i=>placed.get(i.id)!);
}

/** Seat a group (leader first) in the best free spot of the scene, or null when it does not fit anywhere. */
export function placeGroup(scene:Scene,group:SceneItem[]):SceneItem[]|null{
 const [leader,...members]=group,best=suggestPlacements({...scene,items:[...scene.items.filter(i=>!group.some(g=>g.id===i.id)),...group]},leader,members).suggestions[0];
 return best?moveWith(leader,group,best):null;
}
