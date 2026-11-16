import { itemSchema, type SceneItem } from '../core/scene.ts';
import type { Catalog, CatalogExterior } from '../core/catalogs.ts';
/** Convert plan-named openings to the editor's edge/offset form. Rectangle edges: 0 back (left→right), 1 right (top→bottom), 2 front (right→left), 3 left (bottom→top). */
export function catalogOpenings(exterior:CatalogExterior,w:number,d:number):SceneItem['openings']{
  const edge={back:0,right:1,front:2,left:3} as const;
  return exterior.openings.map(o=>{
    const start=o.wall==='back'||o.wall==='right'?o.center-o.width/2:(o.wall==='front'?w:d)-o.center-o.width/2;
    return {edge:edge[o.wall],offset:Math.max(0,Math.round(start*100)/100),width:o.width,height:o.height,sill:Math.round((o.head-o.height)*100)/100,type:o.type};
  });
}
/** A plan carport as a grouped structure next to the house, so it moves with it and takes part in clearance checks. */
export function catalogCarport(exterior:CatalogExterior,house:SceneItem,id:string,name:string):SceneItem|null{
  const c=exterior.carport;if(!c)return null;
  const lx=(c.side==='left'?-1:1)*((house.w+c.width)/2+.02),// ponytail: 2 cm gap so touching ≠ overlap in the clearance check
    ly=house.d/2-c.fromFront-c.depth/2,r=house.rot*Math.PI/180;
  return itemSchema.parse({id,type:'landscape',kind:'pergola',name,x:house.x+lx*Math.cos(r)-ly*Math.sin(r),y:house.y+lx*Math.sin(r)+ly*Math.cos(r),w:c.width,d:c.depth,rot:house.rot,setback:3,group:house.group,architecture:{storeys:1,height:2.6,roof:'flat',pitch:0}});
}
/** Create an editable, self-contained envelope; default height/pitch remain illustrative. */
export function createCatalogItem(catalog:Catalog,modelId:string,position:{id:string;x:number;y:number;rot?:number}):SceneItem {
  const model=catalog.models.find(model=>model.id===modelId);
  if(!model)throw new Error('Catalog model not found');
  return itemSchema.parse({
    ...position,type:'house',name:`${catalog.name} ${model.name}`,w:model.footprint.width,d:model.footprint.depth,
    catalog:{catalogId:catalog.id,catalogVersion:catalog.version,modelId:model.id,modelVersion:model.version},
    architecture:{storeys:1,height:model.exterior?.eavesHeight??3,roof:'gable',pitch:model.exterior?.pitch??30,roofAxis:'width'},
    openings:model.exterior?catalogOpenings(model.exterior,model.footprint.width,model.footprint.depth):[],
    // Finishes come from the catalogue exterior at render time; only user changes are stored here.
    appearance:model.exterior?{}:{roofCovering:'metal',roofColor:'#34383b'},
  });
}
