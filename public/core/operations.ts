import type{SceneItem}from'./scene.ts';
export function transformGroup(items:SceneItem[],id:string,dx:number,dy:number,rotation=0){
 const selected=items.find(i=>i.id===id);if(!selected)return null;const members=items.filter(i=>i.id===id||(selected.group&&i.group===selected.group));if(members.some(i=>i.locked))return null;
 const next=structuredClone(items),r=rotation*Math.PI/180,c=Math.cos(r),s=Math.sin(r);for(const item of next)if(members.some(m=>m.id===item.id)){const x=item.x-selected.x,y=item.y-selected.y;item.x=selected.x+dx+x*c-y*s;item.y=selected.y+dy+x*s+y*c;item.rot=(item.rot+rotation+360)%360;}return next;
}
