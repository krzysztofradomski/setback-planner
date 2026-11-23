import type {SceneItem} from './scene.ts';
import type {CatalogExterior} from './catalogs.ts';
import {catalogCarport} from '../catalogs/placement.ts';
export type Parking='none'|'carport'|'garage';
export function resolveHouseOptions(house:SceneItem,exterior?:CatalogExterior){
 return house.houseOptions??{fireplace:!!exterior?.roof.chimneys.length,recuperation:false,solarPanels:!!exterior?.roof.pv,heatPump:false};
}
/** Prefer explicit ownership; recognize the single annex of older grouped catalog houses. */
export function houseAnnex(items:SceneItem[],house:SceneItem){
 const owned=items.find(i=>i.attachedTo===house.id);if(owned)return owned;
 if(!house.catalog||!house.group)return undefined;
 const candidates=items.filter(i=>i.id!==house.id&&i.group===house.group&&(i.type==='garage'||i.kind==='carport'));
 return candidates.length===1?candidates[0]:undefined;
}
export function houseParking(items:SceneItem[],house:SceneItem):Parking{
 const annex=houseAnnex(items,house);return annex?(annex.type==='garage'?'garage':'carport'):'none';
}
export function setHouseParking(items:SceneItem[],houseId:string,kind:Parking,exterior:CatalogExterior,newId:string):SceneItem[]{
 const house=items.find(i=>i.id===houseId);if(!house||house.type!=='house')throw Error('House not found');
 const previous=houseAnnex(items,house);
 if(house.locked||previous?.locked)throw Error('Unlock the house and its annex first');
 const rest=items.filter(i=>i.id!==previous?.id);
 if(kind==='none')return rest;
 if(rest.length>=100)throw Error('Object limit');
 if(!exterior.carport)throw Error('No parking dimensions');
 const group=house.group||crypto.randomUUID(),nextHouse={...house,group};
 const spec={...exterior,carport:{...exterior.carport,kind}};
 const annex=catalogCarport(spec,nextHouse,newId,kind==='garage'?'Garaż':'Wiata')!;
 return [...rest.map(i=>i.id===houseId?nextHouse:i),annex];
}
