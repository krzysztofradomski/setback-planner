import { outdoorModel } from './outdoor.ts';
import * as THREE from 'three';
import { localFootprint, worldFootprint } from '../core/footprints.ts';
import { materialPresets, resolveAppearance } from '../core/materials.ts';
import type { SceneItem } from '../core/scene.ts';
export type TextureFactory=(materialId:keyof typeof materialPresets,appearance:ReturnType<typeof resolveAppearance>)=>THREE.Texture|null;
export function groundShape(points:{x:number;y:number}[]){return new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.y)));}
export function buildBuilding(item:SceneItem,original=false,textureFactory?:TextureFactory,season='summer'):THREE.Group {
  if(item.type==='landscape'&&item.kind)return outdoorModel(item,season);
  const root=new THREE.Group(),points=localFootprint(item),height=item.architecture.height;
  const appearance=resolveAppearance(original?{}:item.appearance);
  root.name=item.id;root.position.set(item.x,0,item.y);root.rotation.y=-item.rot*Math.PI/180;
  root.userData.footprint=worldFootprint(item);
  points.forEach((a,i)=>{
    const b=points[(i+1)%points.length],length=Math.hypot(b.x-a.x,b.y-a.y);
    const materialId=appearance.walls[String(i)]??appearance.facade,preset=materialPresets[materialId];
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([a.x,0,a.y,b.x,0,b.y,b.x,height,b.y,a.x,height,a.y],3));
    const u=length/(appearance.tileWidth*2),v=height/(appearance.tileHeight*2);
    const uv=appearance.layout==='vertical'?[0,0,0,u,v,u,v,0]:[0,0,u,0,u,v,0,v];
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex([0,2,1,0,3,2]);geometry.computeVertexNormals();
    const texture=textureFactory?.(materialId,appearance)??null;
    const material=new THREE.MeshStandardMaterial({color:texture?'#ffffff':preset.color,map:texture,roughness:preset.roughness,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`wall-${i}`;mesh.userData.materialId=materialId;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  });
  let roofGeometry:THREE.BufferGeometry;
  if(item.shape==='rectangle'&&item.architecture.roof==='gable'){
    const rise=item.w/2*Math.tan(item.architecture.pitch*Math.PI/180);
    const triangle=new THREE.Shape([new THREE.Vector2(-item.w/2,height),new THREE.Vector2(item.w/2,height),new THREE.Vector2(0,height+rise)]);
    roofGeometry=new THREE.ExtrudeGeometry(triangle,{depth:item.d,bevelEnabled:false,steps:1});roofGeometry.translate(0,0,-item.d/2);
  }else{
    roofGeometry=new THREE.ShapeGeometry(groundShape(points));roofGeometry.rotateX(-Math.PI/2);roofGeometry.translate(0,height,0);
    if(item.architecture.roof==='gable')root.userData.approximateRoof=true;
  }
  const roof=new THREE.Mesh(roofGeometry,new THREE.MeshStandardMaterial({color:season==='winter'?'#e5e7e3':appearance.roofColor,roughness:0.65,side:THREE.DoubleSide}));
  roof.name='roof';roof.castShadow=true;roof.receiveShadow=true;root.add(roof);
  return root;
}
export function disposeObject(root:THREE.Object3D){
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(object=>{
    if(object instanceof THREE.Mesh||object instanceof THREE.Line){
      geometries.add(object.geometry);
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        materials.add(material);
        for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);
      }
    }
  });
  textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
  root.clear();
}
