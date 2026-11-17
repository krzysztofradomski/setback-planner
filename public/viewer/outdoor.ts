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
 }else if(spec.render==='carport'){
  // Flat-roof carport as in the Udana Budowa renders: white slab and piers, solid outer wall, timber slat screen at the back.
  // ponytail: the outer wall is on local −x (left of a house facing +y), where catalogue carports sit; mirror via rotation otherwise.
  const white='#f1f1ee',slab=.35;
  box(w+.1,slab,d+.1,0,h-slab/2,0,white);
  box(.25,h-slab,d,-w/2+.125,(h-slab)/2,0,white);
  box(.3,h-slab,.3,w/2-.15,(h-slab)/2,d/2-.15,white);box(.3,h-slab,.3,w/2-.15,(h-slab)/2,-d/2+.15,white);
  const slats=Math.round((w-.4)/.14);for(let i=0;i<slats;i++)box(.09,h-slab-.1,.05,-w/2+.3+i*.14,(h-slab)/2,-d/2+.2,i%2?'#a8743f':'#9a6533');
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
 else{const height=spec.render==='water'?.15:h;const surface=box(w,height,d,0,height/2,0,season==='winter'?'#e4e5df':spec.color);
 if(spec.render==='surface'&&item.kind!=='lawn'&&typeof document!=='undefined'){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');if(ctx){const pattern=item.outdoor.paving;ctx.fillStyle=pattern==='timber'?'#a7835a':pattern==='grass-pavers'?'#719258':'#b9b5a8';ctx.fillRect(0,0,128,128);ctx.strokeStyle='#817d71';ctx.lineWidth=2;if(pattern==='gravel'){for(let i=0;i<300;i++){const x=(Math.sin(i*13.3)+1)*63,y=(Math.cos(i*9.7)+1)*63;ctx.fillStyle=i%2?'#8e8d83':'#d1caba';ctx.fillRect(x,y,3,2);}}else{for(let y=0;y<128;y+=pattern==='timber'?16:32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();}if(pattern!=='timber')for(let x=0;x<128;x+=pattern==='granite'?16:32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,128);ctx.stroke();}}const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(w,d);surface.material.map=texture;surface.material.color.set('#ffffff');}
 }
if(spec.render==='water'){for(const x of [-w/2,w/2])box(.15,.2,d,x,.1,0,'#c9c7b7');}}
 g.position.set(item.x,0,item.y);g.rotation.y=-item.rot*Math.PI/180;g.name=item.id;g.userData.outdoor=true;return g;
}
