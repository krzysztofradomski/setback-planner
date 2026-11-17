import { z } from 'zod';
import { materialIdSchema } from './materials.ts';
const safeId=z.string().min(1).max(80).regex(/^[\w-]+$/);
const sourceUrl=z.url().refine(s=>s.startsWith('https://'));
const localAsset=z.string().regex(/^\/assets\/[\w/.-]+$/);
const area=z.number().finite().positive().nullable();
export const catalogReferenceSchema=z.object({catalogId:safeId,catalogVersion:safeId,modelId:safeId,modelVersion:safeId}).strict();
export type CatalogReference=z.infer<typeof catalogReferenceSchema>;
const metres=(max:number)=>z.number().finite().min(0).max(max);
const hex=z.string().regex(/^#[0-9a-fA-F]{6}$/);
const wall=z.enum(['front','back','left','right']);
/** Manufacturer-independent exterior description. Walls are named as drawn on the plan (front = bottom edge).
 *  Positions are metres from the plan's left edge (front/back) or top edge (left/right). Each part declares its source. */
export const exteriorSchema=z.object({
  eavesHeight:metres(12),pitch:metres(60),overhang:metres(1.5),gableOverhang:metres(1.5),heightSource:z.enum(['manufacturer','render-estimate']),
  wall:materialIdSchema,band:z.object({height:metres(2),color:hex}).strict().nullable(),
  frameColor:hex,doorColor:hex,roofColor:hex,roofCovering:z.enum(['metal','tile','shingle','membrane']),gutterColor:hex,
  openings:z.array(z.object({wall,center:metres(60),width:metres(10),height:metres(4),head:metres(4),type:z.enum(['window','door'])}).strict()).max(48),
  openingsSource:z.enum(['plan','render-estimate']),
  claddings:z.array(z.object({wall,from:metres(60),to:metres(60),material:materialIdSchema}).strict()).max(12),
  canopy:z.object({wall,center:metres(60),width:metres(8),depth:metres(3)}).strict().nullable(),
  roof:z.object({
    pv:z.object({side:z.enum(['front','back']),from:z.number().min(0).max(1),to:z.number().min(0).max(1)}).strict().nullable(),
    windows:z.array(z.object({side:z.enum(['front','back']),at:z.number().min(0).max(1)}).strict()).max(8),
    chimneys:z.array(z.number().min(0).max(1)).max(4),
  }).strict(),
  carport:z.object({kind:z.enum(['carport','garage']).default('carport'),side:z.enum(['left','right']),width:metres(12),depth:metres(15),fromFront:metres(30),height:metres(5).default(2.7),door:hex.optional(),source:z.enum(['plan','render-estimate'])}).strict().nullable(),
  detailsSource:z.literal('render-estimate'),
  /** Ground-floor plan drawing and the fractions of the image (0–1, from the top-left) covered by the footprint rectangle. */
  floorPlan:z.object({src:z.string().regex(/^\/assets\/[\w/.-]+$/),x0:z.number().min(0).max(1),y0:z.number().min(0).max(1),x1:z.number().min(0).max(1),y1:z.number().min(0).max(1)}).strict().optional(),
}).strict();
export type CatalogExterior=z.infer<typeof exteriorSchema>;
export const catalogModelSchema=z.object({
  id:safeId,version:safeId,name:z.string().max(60),source:sourceUrl,
  footprint:z.object({width:z.number().positive().max(1000),depth:z.number().positive().max(1000),kind:z.literal('bounding-envelope'),source:sourceUrl}).strict(),
  floorArea:area,floorAreaKind:z.enum(['usable','total']).nullable(),footprintArea:area,price:z.null(),height:z.null(),
  roof:z.object({type:z.literal('gable'),pitch:z.null(),source:sourceUrl}).strict(),
  thumbnail:localAsset,plan:localAsset,
  assets:z.object({photoOriginal:sourceUrl,planOriginal:sourceUrl,attribution:z.string().max(200)}).strict(),
  geometryStatus:z.literal('verified-envelope'),exterior:exteriorSchema.optional(),notes:z.array(z.string().max(1000)).max(12),
}).strict();
export type CatalogModel=z.infer<typeof catalogModelSchema>;
const catalogSchema=z.object({
  id:safeId,version:safeId,name:z.string().max(100),source:sourceUrl,retrievedAt:z.iso.date(),
  models:z.array(catalogModelSchema).max(100),
}).strict();
export type Catalog=z.infer<typeof catalogSchema>;
// Only trusted, bundled data modules can be loaded. No URLs or uploaded code.
const registrations=Object.freeze({
  'udana-budowa':{name:'Udana Budowa',load:()=>import('../catalogs/udana-budowa.ts')},
});
export const catalogRegistrations=Object.entries(registrations).map(([id,value])=>({id,name:value.name}));
export async function loadCatalog(id:string){
  if(!Object.hasOwn(registrations,id))throw new Error('Catalog is not registered');
  const module=await registrations[id as keyof typeof registrations].load();
  const result=catalogSchema.parse(module.default);
  if(result.id!==id)throw new Error('Catalog identity mismatch');return result;
}
export function catalogAvailable(reference:CatalogReference,enabled:string[]){return Object.hasOwn(registrations,reference.catalogId)&&enabled.includes(reference.catalogId);}
