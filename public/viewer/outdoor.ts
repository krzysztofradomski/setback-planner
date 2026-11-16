import * as T from 'three';
import { objectLibrary } from '../core/objects.ts';
import type { SceneItem } from '../core/scene.ts';
export function outdoorModel(item:SceneItem,season='summer'){
 const spec=objectLibrary[item.kind!],g=new T.Group(),w=item.w,d=item.d,h=item.architecture.height;
 const box=(width:number,height:number,depth:number,x:number,y:number,z:number,color:string,opacity=1)=>{const m=new T.Mesh(new T.BoxGeometry(width,height,depth),new T.MeshStandardMaterial({color,roughness:.85,transparent:opacity<1,opacity}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
 const foliage=item.kind==='evergreen'?spec.color:season==='autumn'?'#b57636':season==='spring'?'#91b75d':season==='winter'?'#b3b7ad':spec.color;
 if(spec.render==='tree'||spec.render==='shrub'){
  const growth=.35+.65*item.outdoor.maturity,height=spec.render==='tree'?h*growth:h;
  if(spec.render==='tree')box(w*.09,height*.65,d*.09,0,height*.325,0,'#766045');
  if(season!=='winter'||item.kind==='evergreen'||spec.render==='shrub'){
   const mesh=new T.Mesh(item.kind==='evergreen'?new T.ConeGeometry(w*.5,height*.85,10):new T.SphereGeometry(1,12,8),new T.MeshStandardMaterial({color:foliage,roughness:1}));
   if(item.kind!=='evergreen')mesh.scale.set(w*.5*growth,height*.4,d*.5*growth);
   mesh.position.y=spec.render==='tree'?height*.65:height*.5;mesh.castShadow=true;g.add(mesh);
  }
 }else if(spec.render==='pergola'||spec.render==='glass'||spec.render==='play'){
  for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])box(.12,h,.12,x,h/2,z,spec.color);
  for(let i=0;i<7;i++)box(w+.2,.12,.12,0,h,-d/2+i*d/6,spec.color);
  if(spec.render==='glass'){box(w,h,d,0,h/2,0,'#abd1cf',.28);}
  if(spec.render==='play'){box(w*.6,.12,d*.6,0,h*.4,0,spec.color);box(.08,h*.65,.08,-w*.2,h*.65,0,'#494f48');box(.08,h*.65,.08,w*.2,h*.65,0,'#494f48');}
 }else if(spec.render==='seat'){
  box(w,.15,d,0,h*.65,0,spec.color);for(const x of [-w*.4,w*.4])for(const z of [-d*.35,d*.35])box(.1,h*.65,.1,x,h*.325,z,'#555d55');
 }else if(spec.render==='flowers'){
  box(w,Math.min(.25,h),d,0,.1,0,'#725c43');
  for(let i=0;i<12;i++){const x=((i%4)+.5)*w/4-w/2,z=(Math.floor(i/4)+.5)*d/3-d/2;box(w/9,h,d/7,x,h/2,z,foliage);}
 }else if(spec.render==='light'){box(.09,h,.09,0,h/2,0,'#48514e');box(.35,.3,.35,0,h,0,'#ffe3a3');}
 else{const height=spec.render==='water'?.15:h;box(w,height,d,0,height/2,0,season==='winter'?'#e4e5df':spec.color);if(spec.render==='water'){for(const x of [-w/2,w/2])box(.15,.2,d,x,.1,0,'#c9c7b7');}}
 g.position.set(item.x,0,item.y);g.rotation.y=-item.rot*Math.PI/180;g.name=item.id;g.userData.outdoor=true;return g;
}
