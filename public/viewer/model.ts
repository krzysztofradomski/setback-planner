import { buildHouseSystems } from './house-systems.ts';
import { outdoorModel } from './outdoor.ts';
import * as THREE from 'three';
import { localFootprint, worldFootprint } from '../core/footprints.ts';
import { materialPresets, resolveAppearance } from '../core/materials.ts';
import type { SceneItem } from '../core/scene.ts';
import type { CatalogExterior } from '../core/catalogs.ts';
import { buildExterior, buildOpening } from './exterior.ts';
export type TextureFactory=(materialId:keyof typeof materialPresets,appearance:ReturnType<typeof resolveAppearance>)=>THREE.Texture|null;
export function groundShape(points:{x:number;y:number}[]){return new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.y)));}
/** Catalogue finishes act as the base layer under the user's overrides, so resets return to the catalogue look. */
export function exteriorDefaults(spec?:CatalogExterior){return spec?{facade:spec.wall,frameColor:spec.frameColor,doorColor:spec.doorColor,roofColor:spec.roofColor,roofCovering:spec.roofCovering,gutterColor:spec.gutterColor,...(spec.band?{trimColor:spec.band.color}:{})}:{};}
export function buildBuilding(item:SceneItem,original=false,textureFactory?:TextureFactory,season='summer',exterior?:CatalogExterior):THREE.Group {
  if(item.type==='landscape'&&item.kind)return outdoorModel(item,season);
  const root=new THREE.Group(),points=localFootprint(item),height=item.architecture.height;
  const appearance=resolveAppearance({...exteriorDefaults(exterior),...(original?{}:item.appearance)});
  root.name=item.id;root.position.set(item.x,0,item.y);root.rotation.y=-item.rot*Math.PI/180;
  root.userData.footprint=worldFootprint(item);
  points.forEach((a,i)=>{
    const b=points[(i+1)%points.length],length=Math.hypot(b.x-a.x,b.y-a.y);
    const materialId=appearance.walls[String(i)]??appearance.facade,preset=materialPresets[materialId];
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([a.x,0,a.y,b.x,0,b.y,b.x,height,b.y,a.x,height,a.y],3));
    const u=length/(((original?undefined:item.appearance.tileWidth)??preset.tileWidth)*2),v=height/(((original?undefined:item.appearance.tileHeight)??preset.tileHeight)*2);
    const uv=appearance.layout==='vertical'?[0,0,0,u,v,u,v,0]:[0,0,u,0,u,v,0,v];
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex([0,2,1,0,3,2]);geometry.computeVertexNormals();
    const texture=textureFactory?.(materialId,appearance)??null;
    const material=new THREE.MeshStandardMaterial({color:texture?'#ffffff':preset.color,map:texture,normalMap:texture?.userData.normalMap??null,normalScale:new THREE.Vector2(.4,.4),roughness:preset.roughness,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geometry,material);mesh.name=`wall-${i}`;mesh.userData.materialId=materialId;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  });
  item.openings.forEach(opening=>{
    const a=points[opening.edge],b=points[(opening.edge+1)%points.length];if(!a||!b)return;const length=Math.hypot(b.x-a.x,b.y-a.y);if(opening.offset+opening.width>length||opening.sill+opening.height>height)return;
    const u=new THREE.Vector3((b.x-a.x)/length,0,(b.y-a.y)/length),n=new THREE.Vector3(u.z,0,-u.x);
    const mesh=buildOpening(new THREE.Vector3(a.x,0,a.y),u,n,opening,appearance,!!exterior);mesh.name=`opening-${opening.type}`;root.add(mesh);
  });
  if(item.type==='house')root.add(buildHouseSystems(item,exterior));
  if(exterior&&item.shape==='rectangle'&&item.architecture.roof==='gable'&&item.architecture.roofAxis==='width'){root.add(buildExterior(item,exterior,appearance,textureFactory,season));return root;}
  let roofGeometry:THREE.BufferGeometry;
  if(item.shape==='rectangle'&&item.architecture.roof==='hip'){
    const hw=item.w/2,hd=item.d/2,rise=Math.min(hw,hd)*Math.tan(item.architecture.pitch*Math.PI/180),longZ=hd>=hw,ridge=Math.abs(hd-hw);
    const p=[[-hw,height,-hd],[hw,height,-hd],[hw,height,hd],[-hw,height,hd],longZ?[0,height+rise,-ridge]:[-ridge,height+rise,0],longZ?[0,height+rise,ridge]:[ridge,height+rise,0]];
    const faces=longZ?[0,1,4,1,2,5,1,5,4,2,3,5,3,0,4,3,4,5]:[0,1,5,0,5,4,1,2,5,2,3,4,2,4,5,3,0,4];roofGeometry=new THREE.BufferGeometry();roofGeometry.setAttribute('position',new THREE.Float32BufferAttribute(faces.flatMap(i=>p[i]),3));roofGeometry.computeVertexNormals();
  }else if(item.shape==='rectangle'&&item.architecture.roof==='shed'){
    const rise=item.w*Math.tan(item.architecture.pitch*Math.PI/180),shape=new THREE.Shape([new THREE.Vector2(-item.w/2,height),new THREE.Vector2(item.w/2,height),new THREE.Vector2(item.w/2,height+rise)]);roofGeometry=new THREE.ExtrudeGeometry(shape,{depth:item.d,bevelEnabled:false});roofGeometry.translate(0,0,-item.d/2);
  }else if(item.shape==='rectangle'&&item.architecture.roof==='gable'){
    const across=item.architecture.roofAxis==='width'?item.d:item.w,along=item.architecture.roofAxis==='width'?item.w:item.d;
    const rise=across/2*Math.tan(item.architecture.pitch*Math.PI/180);
    const triangle=new THREE.Shape([new THREE.Vector2(-across/2,height),new THREE.Vector2(across/2,height),new THREE.Vector2(0,height+rise)]);
    roofGeometry=new THREE.ExtrudeGeometry(triangle,{depth:along,bevelEnabled:false,steps:1});roofGeometry.translate(0,0,-along/2);if(item.architecture.roofAxis==='width')roofGeometry.rotateY(Math.PI/2);
  }else{
    roofGeometry=new THREE.ShapeGeometry(groundShape(points));roofGeometry.rotateX(-Math.PI/2);roofGeometry.translate(0,height,0);
    if(item.architecture.roof==='gable')root.userData.approximateRoof=true;
  }
  let roofMap:THREE.Texture|null=null;
  if(season!=='winter'&&typeof document!=='undefined'&&appearance.roofCovering!=='membrane'){
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle=appearance.roofColor;ctx.fillRect(0,0,128,128);ctx.strokeStyle='#242a2b';ctx.lineWidth=appearance.roofCovering==='metal'?3:1;for(let y=0;y<128;y+=appearance.roofCovering==='metal'?128:32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();}for(let x=0;x<128;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,128);ctx.stroke();}roofMap=new THREE.CanvasTexture(canvas);roofMap.colorSpace=THREE.SRGBColorSpace;roofMap.wrapS=roofMap.wrapT=THREE.RepeatWrapping;const positions=roofGeometry.getAttribute('position'),uv:number[]=[];for(let i=0;i<positions.count;i++)uv.push(positions.getX(i)/.6,positions.getZ(i)/.6);roofGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));}
  }
  const roofMaterial=new THREE.MeshStandardMaterial({color:season==='winter'?'#e5e7e3':roofMap?'#ffffff':appearance.roofColor,map:season==='winter'?null:roofMap,roughness:0.65,side:THREE.DoubleSide});
  const roof=new THREE.Mesh(roofGeometry,roofGeometry instanceof THREE.ExtrudeGeometry?[new THREE.MeshStandardMaterial({color:materialPresets[appearance.facade].color,roughness:.85}),roofMaterial]:roofMaterial);
  roof.name='roof';roof.castShadow=true;roof.receiveShadow=true;root.add(roof);
  return root;
}
export function disposeObject(root:THREE.Object3D){
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(object=>{
    if(object instanceof THREE.InstancedMesh)object.dispose();
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
