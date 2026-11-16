import { z } from 'zod';
const safeId=z.string().min(1).max(80).regex(/^[\w-]+$/);
const sourceUrl=z.url().refine(s=>s.startsWith('https://'));
const localAsset=z.string().regex(/^\/assets\/[\w/.-]+$/);
const area=z.number().finite().positive().nullable();
export const catalogReferenceSchema=z.object({catalogId:safeId,catalogVersion:safeId,modelId:safeId,modelVersion:safeId}).strict();
export type CatalogReference=z.infer<typeof catalogReferenceSchema>;
export const catalogModelSchema=z.object({
  id:safeId,version:safeId,name:z.string().max(60),source:sourceUrl,
  footprint:z.object({width:z.number().positive().max(1000),depth:z.number().positive().max(1000),kind:z.literal('bounding-envelope'),source:sourceUrl}).strict(),
  floorArea:area,floorAreaKind:z.enum(['usable','total']).nullable(),footprintArea:area,price:z.null(),height:z.null(),
  roof:z.object({type:z.literal('gable'),pitch:z.null(),source:sourceUrl}).strict(),
  thumbnail:localAsset,plan:localAsset,
  assets:z.object({photoOriginal:sourceUrl,planOriginal:sourceUrl,attribution:z.string().max(200)}).strict(),
  geometryStatus:z.literal('verified-envelope'),notes:z.array(z.string().max(1000)).max(12),
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
