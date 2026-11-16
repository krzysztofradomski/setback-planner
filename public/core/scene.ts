import { z } from 'zod';
import { catalogReferenceSchema } from './catalogs.ts';
import { appearanceSchema } from './materials.ts';
import { fenceSchema } from './fences.ts';
import { objectLibrary } from './objects.ts';
import { validRing } from './geometry.ts';
export const MAX_PROJECT_BYTES=262144;
const finite=z.number().finite();
const coord=finite.min(-1e5).max(1e5);
export const pointSchema=z.object({x:coord,y:coord}).strict();
export const itemSchema=z.object({
  id:z.string().min(1).max(80).regex(/^[\w-]+$/),type:z.enum(['house','garage','landscape']),name:z.string().max(60),
  x:coord,y:coord,w:finite.min(0.5).max(1000),d:finite.min(0.5).max(1000),
  kind:z.enum(Object.keys(objectLibrary) as [keyof typeof objectLibrary,...(keyof typeof objectLibrary)[]]).optional(),
  outdoor:z.object({maturity:finite.min(0).max(1).default(1),matureWidth:finite.min(0.5).max(50).default(4),matureHeight:finite.min(0.1).max(50).default(6),paving:z.enum(['granite','concrete','gravel','timber','grass-pavers']).default('concrete')}).default({maturity:1,matureWidth:4,matureHeight:6,paving:'concrete'}),
  catalog:catalogReferenceSchema.optional(),
  appearance:appearanceSchema.default({}),
  shape:z.enum(['rectangle','L','T','U']).default('rectangle'),wingRatio:finite.min(0.15).max(0.45).default(0.3),
  architecture:z.object({storeys:z.number().int().min(1).max(3),height:finite.min(0.02).max(30),roof:z.enum(['flat','gable']),pitch:finite.min(0).max(60)}).strict().default({storeys:1,height:3,roof:'gable',pitch:30}),
  rot:finite.min(-36000).max(36000).default(0),setback:finite.min(0).max(1000).default(4),
}).strict();
export const sceneSchema=z.object({
  schemaVersion:z.literal(2),units:z.literal('m'),
  coordinates:z.object({crs:z.literal('LOCAL'),axis:z.literal('x-east-y-south'),projected:z.object({crs:z.literal('EPSG:2180'),origin:z.object({x:finite.min(0).max(1.2e6),y:finite.min(0).max(1.2e6)}).strict()}).strict().optional()}).strict(),
  parcel:z.object({identifier:z.string().max(80).optional(),source:z.object({name:z.string().min(1).max(120),retrievedAt:z.iso.datetime({offset:true}),crs:z.enum(['EPSG:4326','EPSG:2180']),url:z.url().refine(s=>s.startsWith('https://')).optional()}).strict(),edited:z.boolean()}).strict().optional(),
  plot:z.array(pointSchema).min(3).max(512).refine(validRing,'Invalid parcel boundary'),
  items:z.array(itemSchema).max(100).refine(items=>new Set(items.map(i=>i.id)).size===items.length,'Duplicate object IDs'),
  fences:z.array(fenceSchema).max(12).default([]),
  environment:z.object({season:z.enum(['spring','summer','autumn','winter']),date:z.iso.datetime(),latitude:finite.min(-90).max(90),longitude:finite.min(-180).max(180),weather:z.enum(['clear','clouds','rain','snow'])}).strict().default({season:'summer',date:'2026-06-21T10:00:00Z',latitude:52,longitude:19,weather:'clear'}),
  snap:z.union([z.literal(0),z.literal(0.1),z.literal(0.25),z.literal(0.5),z.literal(1)]).default(0.5),
  dimScope:z.enum(['all','selected']).default('all'),showPairs:z.boolean().default(true),
}).strict();
export type Scene=z.infer<typeof sceneSchema>;
export type SceneItem=z.infer<typeof itemSchema>;
export function parseScene(input:unknown):Scene {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new Error('Invalid project');
  const raw=input as Record<string,unknown>;
  if(raw.schemaVersion!==undefined && raw.schemaVersion!==2) throw new Error('Unsupported scene version');
  if(raw.schemaVersion===2) return sceneSchema.parse(raw);
  // Legacy imports are migrated atomically. Do not silently discard unknown objects.
  const legacy=z.object({plot:z.unknown(),items:z.array(z.record(z.string(),z.unknown())).max(100).default([]),snap:z.unknown().optional(),dimScope:z.unknown().optional(),showPairs:z.unknown().optional()}).strict().parse(raw);
  return sceneSchema.parse({...legacy,schemaVersion:2,units:'m',coordinates:{crs:'LOCAL',axis:'x-east-y-south'},items:legacy.items.map((i,n)=>({...i,id:String(i.id||`o${n+1}`),name:String(i.name||i.type||'Building').slice(0,60),setback:i.setback??(i.type==='garage'?3:4)}))});
}
export function serializeScene(scene:Scene):string {
  const json=JSON.stringify(parseScene(scene));
  if(new TextEncoder().encode(json).length>MAX_PROJECT_BYTES) throw new Error('Project is too large');
  return json;
}
const b64=(bytes:Uint8Array)=>{
  let binary='';for(const byte of bytes) binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
export const plainShare=(scene:Scene)=>'#p='+b64(new TextEncoder().encode(serializeScene(scene)));
export async function encodeShare(scene:Scene,compressed=true):Promise<string> {
  if(!compressed||typeof CompressionStream==='undefined') return plainShare(scene);
  const json=serializeScene(scene);
  try {
    const stream=new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return '#s='+b64(new Uint8Array(await new Response(stream).arrayBuffer()));
  } catch { return plainShare(scene); }
}
export async function decodeShare(hash:string):Promise<Scene> {
  if(hash.length>MAX_PROJECT_BYTES*1.4) throw new Error('Shared project is too large');
  const match=hash.match(/^#([psz])=([\w-]+)$/);
  if(!match) throw new Error('Invalid project link');
  const bytes=Uint8Array.from(atob(match[2].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  let json:string;
  if(match[1]==='p') {
    if(bytes.length>MAX_PROJECT_BYTES) throw new Error('Project is too large');
    json=new TextDecoder().decode(bytes);
  } else {
    const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const chunks:Uint8Array[]=[];let total=0;
    try {
      while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>MAX_PROJECT_BYTES)throw new Error('Project is too large');chunks.push(value);}
    } finally { await reader.cancel(); }
    const result=new Uint8Array(total);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}
    json=new TextDecoder().decode(result);
  }
  const raw:unknown=JSON.parse(json);
  if(match[1]!=='z') return parseScene(raw);
  const compact=z.tuple([z.array(finite).length(8),z.array(z.tuple([z.enum(['house','garage']),z.string().max(60),coord,coord,finite,finite,finite,finite])).max(100),z.unknown(),z.unknown(),z.union([z.literal(0),z.literal(1)])]).parse(raw);
  const [plot,items,snap,dimScope,showPairs]=compact;
  return parseScene({plot:[0,2,4,6].map(i=>({x:plot[i],y:plot[i+1]})),items:items.map(([type,name,x,y,w,d,rot,setback])=>({type,name,x,y,w,d,rot,setback})),snap,dimScope,showPairs:!!showPairs});
}
