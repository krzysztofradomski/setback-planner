import proj4 from 'proj4';
import { z } from 'zod';
import { validRing, signedArea } from './geometry.ts';
import { sceneSchema } from './scene.ts';
// PL-1992 parameters: Dz.U. 2024 poz.342, annex 4. proj4 uses easting,northing.
proj4.defs('EPSG:2180','+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 +units=m +no_defs');
export type ImportCrs='EPSG:4326'|'EPSG:2180';
export const projectPoint=(p:[number,number])=>proj4('EPSG:4326','EPSG:2180',p) as [number,number];
export const geographicPoint=(p:[number,number])=>proj4('EPSG:2180','EPSG:4326',p) as [number,number];
const pair=z.tuple([z.number().finite(),z.number().finite()]);
const ring=z.array(pair).min(4).max(513);
const polygon=z.object({type:z.literal('Polygon'),coordinates:z.array(ring).length(1,'Parcel holes are not yet supported')});
export function importParcel(input:unknown,crs:ImportCrs,name:string,retrievedAt:string){
  if(crs!=='EPSG:4326'&&crs!=='EPSG:2180')throw new Error('Unsupported CRS');
  const wrapper=z.record(z.string(),z.unknown()).parse(input);
  if(wrapper.crs)throw new Error('Ambiguous CRS: remove legacy CRS declarations and select the source CRS explicitly');
  let geometry:unknown=wrapper;
  if(wrapper.type==='Feature') geometry=wrapper.geometry;
  if(wrapper.type==='FeatureCollection'){
    const features=z.array(z.object({type:z.literal('Feature'),geometry:z.unknown()})).length(1).parse(wrapper.features);
    geometry=features[0].geometry;
  }
  const raw=z.record(z.string(),z.unknown()).parse(geometry);
  if(raw.crs)throw new Error('Ambiguous CRS');
  if(raw.type==='MultiPolygon'){
    const parts=z.array(z.array(ring)).length(1,'Separate parcel parts are not yet supported').parse(raw.coordinates);
    geometry={type:'Polygon',coordinates:parts[0]};
  }
  const coordinates=polygon.parse(geometry).coordinates[0];
  if(coordinates[0][0]!==coordinates.at(-1)![0]||coordinates[0][1]!==coordinates.at(-1)![1])throw new Error('Parcel ring must be closed');
  const projected=coordinates.slice(0,-1).map(p=>{
    if(crs==='EPSG:4326'){
      if(p[0]<13||p[0]>25||p[1]<48||p[1]>56)throw new Error('Coordinates outside supported Polish region');
      return projectPoint(p);
    }
    if(p.some(v=>v<0||v>1.2e6))throw new Error('Invalid PL-1992 coordinates');
    return p;
  });
  const origin={x:projected[0][0],y:projected[0][1]};
  let plot=projected.map(([x,y])=>({x:x-origin.x,y:origin.y-y}));
  if(!validRing(plot))throw new Error('Invalid parcel geometry');
  if(signedArea(plot)<0)plot=[plot[0],...plot.slice(1).reverse()];
  const result=sceneSchema.pick({plot:true,coordinates:true,parcel:true}).required({parcel:true}).parse({plot,coordinates:{crs:'LOCAL',axis:'x-east-y-south',projected:{crs:'EPSG:2180',origin}},parcel:{source:{name,retrievedAt,crs},edited:false}});
  return result;
}
