import { itemSchema, type SceneItem } from '../core/scene.ts';
import type { Catalog } from '../core/catalogs.ts';
/** Create an editable, self-contained envelope; default height/pitch remain illustrative. */
export function createCatalogItem(catalog:Catalog,modelId:string,position:{id:string;x:number;y:number;rot?:number}):SceneItem {
  const model=catalog.models.find(model=>model.id===modelId);
  if(!model)throw new Error('Catalog model not found');
  return itemSchema.parse({
    ...position,type:'house',name:`${catalog.name} ${model.name}`,w:model.footprint.width,d:model.footprint.depth,
    catalog:{catalogId:catalog.id,catalogVersion:catalog.version,modelId:model.id,modelVersion:model.version},
    appearance:{roofCovering:'metal',roofColor:'#34383b'},
  });
}
