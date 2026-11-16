import { transformFootprint, type Point } from './geometry.ts';
export interface Footprint {w:number;d:number;shape?:'rectangle'|'L'|'T'|'U'|'custom';custom?:Point[];wingRatio?:number}
export interface PlacedFootprint extends Footprint {x:number;y:number;rot:number}
export function localFootprint(item:Footprint):Point[] {
  if(item.shape==='custom'&&item.custom)return item.custom.map(p=>({x:p.x*item.w,y:p.y*item.d}));
  const w=item.w,d=item.d,a=item.wingRatio??0.3;
  let points:number[][];
  switch(item.shape){
    case 'L': points=[[0,0],[w,0],[w,a*d],[a*w,a*d],[a*w,d],[0,d]];break;
    case 'T': points=[[0,0],[w,0],[w,a*d],[(1+a)*w/2,a*d],[(1+a)*w/2,d],[(1-a)*w/2,d],[(1-a)*w/2,a*d],[0,a*d]];break;
    case 'U': points=[[0,0],[w,0],[w,d],[(1-a)*w,d],[(1-a)*w,a*d],[a*w,a*d],[a*w,d],[0,d]];break;
    default: points=[[0,0],[w,0],[w,d],[0,d]];
  }
  return points.map(([x,y])=>({x:x-w/2,y:y-d/2}));
}
export const worldFootprint=(item:PlacedFootprint)=>transformFootprint(localFootprint(item),item);
export const boundingCorners=(item:PlacedFootprint)=>transformFootprint(localFootprint({w:item.w,d:item.d}),item);
/** Keep openings inside their walls after a resize: slide first, shrink only if the wall is now too short or low. */
export function fitOpenings<T extends PlacedFootprint & {openings:{edge:number;offset:number;width:number;height:number;sill:number}[];architecture:{height:number}}>(item:T):T['openings']{
  const points=localFootprint(item),h=item.architecture.height;
  return item.openings.filter(o=>points[o.edge]).map(o=>{
    const a=points[o.edge],b=points[(o.edge+1)%points.length],length=Math.hypot(b.x-a.x,b.y-a.y);
    const width=Math.min(o.width,Math.max(.2,length-.2)),offset=Math.min(Math.max(0,o.offset),Math.max(0,length-width));
    const height=Math.min(o.height,Math.max(.2,h-.05)),sill=Math.min(o.sill,Math.max(0,h-height));
    return width===o.width&&offset===o.offset&&height===o.height&&sill===o.sill?o:{...o,width,offset,height,sill};
  });
}
