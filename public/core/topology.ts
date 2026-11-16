import {containsPolygon,polygonRelation,polygonArea,validRing,pointLocation,type Point} from './geometry.ts';
export interface ParcelTopology {plot:Point[];plotHoles?:Point[][];plotParts?:Point[][][]}
export const parcelPolygons=(scene:ParcelTopology):Point[][][]=>[[scene.plot,...(scene.plotHoles??[])],...(scene.plotParts??[])];
export function validateTopology(scene:ParcelTopology){
 const parts=parcelPolygons(scene);if(parts.flat(2).length>512)throw new Error('Parcel exceeds 512 total vertices');
 for(const [outer,...holes]of parts){if(!validRing(outer))throw new Error('Invalid outer boundary');for(let i=0;i<holes.length;i++){if(!validRing(holes[i])||!containsPolygon(outer,holes[i])||!holes[i].every(p=>pointLocation(p,outer)==='inside'))throw new Error('Invalid parcel hole');for(let j=0;j<i;j++)if(polygonRelation(holes[i],holes[j])!=='disjoint')throw new Error('Parcel holes intersect');}}
 for(let i=0;i<parts.length;i++)for(let j=0;j<i;j++)if(polygonRelation(parts[i][0],parts[j][0])!=='disjoint')throw new Error('Parcel components intersect');
 return true;
}
export function parcelContains(scene:ParcelTopology,footprint:Point[]){return parcelPolygons(scene).some(([outer,...holes])=>containsPolygon(outer,footprint)&&holes.every(h=>polygonRelation(h,footprint)==='disjoint'));}
export const parcelArea=(scene:ParcelTopology)=>parcelPolygons(scene).reduce((sum,[outer,...holes])=>sum+polygonArea(outer)-holes.reduce((n,h)=>n+polygonArea(h),0),0);
