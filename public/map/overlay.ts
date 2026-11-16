import type { FeatureCollection, Feature, Polygon } from 'geojson';
import { geographicPoint } from '../core/geospatial.ts';
import { worldFootprint } from '../core/footprints.ts';
import { validRing, type Point } from '../core/geometry.ts';
import type { Scene } from '../core/scene.ts';
export function projectOverlay(project:Scene):FeatureCollection<Polygon> {
  const projected=project.coordinates.projected;
  if(!projected)return {type:'FeatureCollection',features:[]};
  const toRing=(points:Point[])=>{const ring=points.map(p=>geographicPoint([projected.origin.x+p.x,projected.origin.y-p.y]));return [...ring,ring[0]];};
  const features:Feature<Polygon>[]=[];
  if(validRing(project.plot))features.push({type:'Feature',properties:{kind:'parcel'},geometry:{type:'Polygon',coordinates:[toRing(project.plot)]}});
  for(const item of project.items)features.push({type:'Feature',properties:{kind:item.type,id:item.id},geometry:{type:'Polygon',coordinates:[toRing(worldFootprint(item))]}});
  return {type:'FeatureCollection',features};
}
