import * as T from 'three';import {fenceSegments,type Fence} from '../core/fences.ts';
export function buildFence(f:Fence,season:string){
 const root=new T.Group(),segments=fenceSegments(f),hedge=f.type.startsWith('hedge'),height=f.height*(hedge?.3+.7*f.maturity:1),color=hedge?(season==='winter'&&f.type==='hedge-deciduous'?'#a39982':season==='autumn'&&f.type==='hedge-deciduous'?'#aa7948':'#567e45'):f.color;
 const panels=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color,roughness:.9,transparent:f.type==='metal-panel',opacity:f.type==='metal-panel'?.65:1}),segments.length);
 const posts=new T.InstancedMesh(new T.BoxGeometry(.12,1,.12),new T.MeshStandardMaterial({color:f.color}),segments.length*2),object=new T.Object3D();
 segments.forEach((s,i)=>{const length=Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y),angle=Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x),open=s.gate&&f.gate?.open;
 object.position.set((s.a.x+s.b.x)/2,height/2,(s.a.y+s.b.y)/2);object.rotation.set(0,-angle,0);object.scale.set(length-.03,height,f.width);
 if(open){if(f.gate?.type==='sliding')object.position.add(new T.Vector3(Math.cos(angle)*length,0,Math.sin(angle)*length));else{const turn=f.gate?.inward?1:-1;object.rotation.y-=turn*Math.PI/2;object.position.set(s.a.x-Math.sin(angle)*turn*length/2,height/2,s.a.y+Math.cos(angle)*turn*length/2);}}
 object.updateMatrix();panels.setMatrixAt(i,object.matrix);
 [s.a,s.b].forEach((p,j)=>{object.position.set(p.x,height/2,p.y);object.rotation.set(0,0,0);object.scale.set(1,height+f.foundation,1);object.updateMatrix();posts.setMatrixAt(i*2+j,object.matrix);});
 });panels.castShadow=true;posts.castShadow=true;root.add(panels);if(!hedge)root.add(posts);else{posts.geometry.dispose();(posts.material as T.Material).dispose();}return root;
}
