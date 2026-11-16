import { transformFootprint, type Point } from './geometry.ts';
export interface Footprint {w:number;d:number;shape?:'rectangle'|'L'|'T'|'U';wingRatio?:number}
export interface PlacedFootprint extends Footprint {x:number;y:number;rot:number}
export function localFootprint(item:Footprint):Point[] {
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
