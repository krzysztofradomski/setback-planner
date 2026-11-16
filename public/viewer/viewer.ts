import {sunPosition,seasonalGround} from '../core/environment.ts';
import {geographicPoint} from '../core/geospatial.ts';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildBuilding, groundShape, disposeObject, type TextureFactory } from './model.ts';
import { materialPresets } from '../core/materials.ts';
import { validRing } from '../core/geometry.ts';
import type { Scene } from '../core/scene.ts';
const makeTexture:TextureFactory=(id,appearance)=>{
  const preset=materialPresets[id];if(preset.pattern==='plain')return null;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  ctx.fillStyle=appearance.grout;ctx.fillRect(0,0,256,128);ctx.fillStyle=preset.color;
  if(preset.pattern==='brick'){
    for(let row=0;row<2;row++)for(let col=-1;col<3;col++)ctx.fillRect(col*128+(row%2)*64+2,row*64+2,124,60);
  } else {ctx.fillRect(2,0,124,128);ctx.fillRect(130,0,124,128);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
};
export function createViewer(container:HTMLElement,onFailure:()=>void){
  const canvas=document.createElement('canvas'),context=canvas.getContext('webgl2',{antialias:true});
  if(!context)throw new Error('WebGL2 unavailable');
  const renderer=new THREE.WebGLRenderer({canvas,context,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.setClearColor('#dce4e7');renderer.domElement.setAttribute('aria-label','Interactive 3D parcel view');renderer.domElement.setAttribute('role','img');
  container.append(renderer.domElement);
  const scene=new THREE.Scene(),content=new THREE.Group();scene.add(content);
  const camera=new THREE.PerspectiveCamera(42,1,0.1,10000),controls=new OrbitControls(camera,renderer.domElement);
  controls.maxPolarAngle=Math.PI*0.49;controls.enableDamping=false;controls.minDistance=2;controls.maxDistance=2000;
  const ambient=new THREE.HemisphereLight('#e6f2ff','#6e775f',2);scene.add(ambient);
  const sun=new THREE.DirectionalLight('#fff2d8',3);sun.position.set(-30,60,-35);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-0.0005;scene.add(sun,sun.target);
  let active=true,signature='',extent=50,center=new THREE.Vector3(),disposed=false;
  const render=()=>{if(active&&!disposed)renderer.render(scene,camera);};
  controls.addEventListener('change',render);
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();render();};
  const observer=new ResizeObserver(resize);observer.observe(container);
  const failure=(event:Event)=>{event.preventDefault();active=false;onFailure();};renderer.domElement.addEventListener('webglcontextlost',failure);
  function view(mode:'top'|'axonometric'|'orbit'){
    camera.up.set(0,1,0);controls.target.copy(center);
    const offset=mode==='top'?new THREE.Vector3(0,extent*1.6,0.001):new THREE.Vector3(extent*0.85,extent,extent*1.15);
    camera.position.copy(center).add(offset);camera.lookAt(center);controls.update();render();
  }
  function update(project:Scene,original=false){
    const next=JSON.stringify([project.plot,project.items,project.environment,project.coordinates,original]);if(next===signature){render();return;}signature=next;
    disposeObject(content);
    if(validRing(project.plot)){
      const ground=new THREE.Mesh(new THREE.ShapeGeometry(groundShape(project.plot)),new THREE.MeshStandardMaterial({color:seasonalGround[project.environment.season],side:THREE.DoubleSide,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-0.015;ground.receiveShadow=true;content.add(ground);
      const boundary=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(project.plot.map(p=>new THREE.Vector3(p.x,0.03,p.y))),new THREE.LineBasicMaterial({color:'#405442'}));content.add(boundary);
    }
    for(const item of project.items)content.add(buildBuilding(item,original,makeTexture,project.environment.season));
    content.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(content),size=bounds.getSize(new THREE.Vector3());
    center=bounds.getCenter(new THREE.Vector3());extent=Math.max(size.x,size.z,20);
    const range=extent,env=project.environment,origin=project.coordinates.projected?.origin;
    const [lon,lat]=origin?geographicPoint([origin.x,origin.y]):[env.longitude,env.latitude];
    const position=sunPosition(env.date,lat,lon);sun.target.position.copy(center);sun.position.copy(center).add(new THREE.Vector3(position.direction.x,position.direction.y,position.direction.z).multiplyScalar(range*2));sun.intensity=position.daylight?(env.weather==='clear'?3:1.2):0;ambient.intensity=position.daylight?1.8:.18;
    renderer.setClearColor(position.daylight?'#dce4e7':'#15212f');scene.fog=env.weather==='clear'?null:new THREE.Fog('#b7c1c4',range*1.5,range*4);
    Object.assign(sun.shadow.camera,{left:-range,right:range,top:range,bottom:-range,near:0.1,far:range*5});sun.shadow.camera.updateProjectionMatrix();
    if(camera.position.length()===0)view('axonometric');render();
    return content.children.some(c=>c.userData.approximateRoof);
  }
  return {update,view,
    setActive(value:boolean){active=value;if(value)resize();},
    quality(low:boolean){renderer.setPixelRatio(low?1:Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=!low;resize();},
    screenshot(){render();return renderer.domElement.toDataURL('image/png');},
    dispose(){disposed=true;observer.disconnect();controls.dispose();disposeObject(content);sun.shadow.dispose();renderer.domElement.removeEventListener('webglcontextlost',failure);renderer.dispose();renderer.domElement.remove();},
    memory(){return {...renderer.info.memory};},
  };
}
