import { z } from 'zod';
const safeId=z.string().min(1).max(80).regex(/^[\w-]+$/);
export const catalogReferenceSchema=z.object({catalogId:safeId,catalogVersion:safeId,modelId:safeId,modelVersion:safeId}).strict();
export type CatalogReference=z.infer<typeof catalogReferenceSchema>;
const catalogSchema=z.object({
  id:safeId,version:safeId,name:z.string().max(100),source:z.url().refine(s=>s.startsWith('https://')),retrievedAt:z.iso.date(),
  models:z.array(z.object({id:safeId,version:safeId,name:z.string().max(60),footprint:z.null(),price:z.null(),geometryStatus:z.literal('unverified')})).max(100),
}).strict();
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
