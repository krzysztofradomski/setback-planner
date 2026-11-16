import { z } from 'zod';
import { parseScene, sceneSchema, type Scene } from './scene.ts';
/** Bounded, detached scene snapshots; ordinary edits invalidate the redo branch. */
export class ProjectHistory {
  private past:Scene[]=[];
  private future:Scene[]=[];
  private limit:number;
  constructor(limit=150){this.limit=limit;}
  record(scene:Scene){this.past.push(structuredClone(scene));if(this.past.length>this.limit)this.past.shift();this.future=[];}
  undo(current:Scene):Scene|null {const next=this.past.pop();if(!next)return null;this.future.push(structuredClone(current));return structuredClone(next);}
  redo(current:Scene):Scene|null {const next=this.future.pop();if(!next)return null;this.past.push(structuredClone(current));return structuredClone(next);}
}
const variantSchema=z.object({id:z.string().min(1).max(80),name:z.string().trim().min(1).max(60),scene:sceneSchema}).strict();
export type Variant=z.infer<typeof variantSchema>;
const variantsSchema=z.array(variantSchema).max(20).refine(v=>new Set(v.map(i=>i.id)).size===v.length);
export function readVariants(json:string):Variant[] {
  if(json.length>6e6) throw new Error('Variant collection is too large');
  return variantsSchema.parse(JSON.parse(json)).map(v=>({...v,scene:parseScene(v.scene)}));
}
export function saveVariant(variants:Variant[],entry:Variant):Variant[] {
  const valid=variantSchema.parse({...entry,scene:parseScene(entry.scene)});
  return variantsSchema.parse([...variants.filter(v=>v.id!==valid.id),valid]);
}
