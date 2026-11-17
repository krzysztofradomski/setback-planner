import {terrainHeight} from '../core/terrain.ts';
import {parcelPolygons} from '../core/topology.ts';
import {buildFence} from './fences.ts';import {boundaryFence,BOUNDARY_FENCE_ID} from '../core/fences.ts';
import {sunPosition,seasonalGround} from '../core/environment.ts';
import {geographicPoint} from '../core/geospatial.ts';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildBuilding, groundShape, disposeObject, type TextureFactory } from './model.ts';
import { materialPresets } from '../core/materials.ts';
import { validRing } from '../core/geometry.ts';
import type { Scene } from '../core/scene.ts';
import type { SceneContext } from '../core/context.ts';
import type { CatalogExterior } from '../core/catalogs.ts';
import { setbackArea } from '../core/placement.ts';
import { pointLocation } from '../core/geometry.ts';
const makeTexture:TextureFactory=(id,appearance)=>{
  const preset=materialPresets[id];if(preset.pattern==='plain')return null;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  ctx.fillStyle=appearance.grout;ctx.fillRect(0,0,256,128);ctx.fillStyle=preset.color;
  if(preset.pattern==='brick'){
    for(let row=0;row<2;row++)for(let col=-1;col<3;col++)ctx.fillRect(col*128+(row%2)*64+2,row*64+2,124,60);
  } else {ctx.fillRect(2,0,124,128);ctx.fillRect(130,0,124,128);}
  const normalCanvas=document.createElement('canvas');normalCanvas.width=256;normalCanvas.height=128;const normalCtx=normalCanvas.getContext('2d');let normalMap:THREE.CanvasTexture|null=null;
  if(normalCtx){const pixels=normalCtx.createImageData(256,128),height=(x:number,y:number)=>{x=(x+256)%256;y=(y+128)%128;if(preset.pattern==='boards')return x%128<3?0:1;const row=Math.floor(y/64),column=(x-row*64+256)%128;return y%64<3||column<3?0:1;};for(let y=0;y<128;y++)for(let x=0;x<256;x++){const nx=height(x-1,y)-height(x+1,y),ny=height(x,y-1)-height(x,y+1),n=new THREE.Vector3(nx,ny,1).normalize(),i=(y*256+x)*4;pixels.data[i]=(n.x+1)*127.5;pixels.data[i+1]=(n.y+1)*127.5;pixels.data[i+2]=(n.z+1)*127.5;pixels.data[i+3]=255;}normalCtx.putImageData(pixels,0,0);normalMap=new THREE.CanvasTexture(normalCanvas);normalMap.wrapS=normalMap.wrapT=THREE.RepeatWrapping;}
  const texture=new THREE.CanvasTexture(canvas);texture.userData.normalMap=normalMap;texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
};
export function createViewer(container:HTMLElement,onFailure:()=>void){
  const canvas=document.createElement('canvas'),context=canvas.getContext('webgl2',{antialias:true});
  if(!context)throw new Error('WebGL2 unavailable');
  const renderer=new THREE.WebGLRenderer({canvas,context,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  renderer.setClearColor('#dce4e7');renderer.domElement.setAttribute('aria-label','Interactive 3D parcel view');renderer.domElement.setAttribute('role','img');
  container.append(renderer.domElement);
  const scene=new THREE.Scene(),content=new THREE.Group();scene.add(content);
  // Sky gradient and a neutral meadow around the parcel so the plot sits in a landscape, fading into the horizon fog.
  const sky=(top:string,horizon:string)=>{const c=document.createElement('canvas');c.width=2;c.height=256;const g=c.getContext('2d');if(g){const grad=g.createLinearGradient(0,0,0,256);grad.addColorStop(0,top);grad.addColorStop(1,horizon);g.fillStyle=grad;g.fillRect(0,0,2,256);}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;};
  const daySky=sky('#5ea8ff','#e8f2ff'),nightSky=sky('#070d16','#1b2838'),greySky=sky('#8e989f','#d3d8da');
  // Rain and snow particles around the parcel; animated only while visible.
  let weatherFx:THREE.LineSegments|THREE.Points|null=null,weatherKind='clear',weatherBox=new THREE.Box3(),frame=0,last=0;
  function setWeather(kind:string,center:THREE.Vector3,range:number){
    if(weatherFx){scene.remove(weatherFx);weatherFx.geometry.dispose();(weatherFx.material as THREE.Material).dispose();weatherFx=null;}
    weatherKind=kind;if(kind!=='rain'&&kind!=='snow')return;
    const half=Math.min(range*1.4,120),count=kind==='rain'?5000:3500,top=30,pos=new Float32Array(count*(kind==='rain'?6:3));
    weatherBox=new THREE.Box3(new THREE.Vector3(center.x-half,0,center.z-half),new THREE.Vector3(center.x+half,top,center.z+half));
    for(let i=0;i<count;i++){const x=center.x+(Math.random()*2-1)*half,y=Math.random()*top,z=center.z+(Math.random()*2-1)*half;if(kind==='rain'){pos.set([x,y,z,x+.05,y+.6,z],i*6);}else pos.set([x,y,z],i*3);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));
    weatherFx=kind==='rain'?new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#aebccb',transparent:true,opacity:.5})):new THREE.Points(geometry,new THREE.PointsMaterial({color:'#ffffff',size:.14,transparent:true,opacity:.9,depthWrite:false}));
    weatherFx.frustumCulled=false;scene.add(weatherFx);if(!frame)frame=requestAnimationFrame(tick);
  }
  function tick(now:number){
    frame=0;if(disposed||!weatherFx)return;if(!active){frame=requestAnimationFrame(tick);return;}
    const dt=Math.min(.05,(now-(last||now))/1000),attr=weatherFx.geometry.getAttribute('position') as THREE.BufferAttribute,a=attr.array as Float32Array,rain=weatherKind==='rain',step=rain?6:3,fall=(rain?18:1.1)*dt,{min,max}=weatherBox;last=now;
    for(let i=0;i<a.length;i+=step){a[i+1]-=fall;if(rain)a[i+4]-=fall;else{a[i]+=Math.sin(now/900+i)*.004;}if(a[i+1]<0){const y=max.y;a[i+1]=y;if(rain)a[i+4]=y+.6;}if(a[i]<min.x||a[i]>max.x)a[i]=min.x+Math.random()*(max.x-min.x);}
    attr.needsUpdate=true;renderer.render(scene,camera);frame=requestAnimationFrame(tick);
  }
  const contextGroup=new THREE.Group();scene.add(contextGroup);let contextActive=false,contextReady:Promise<void>=Promise.resolve();
  const land=new THREE.Mesh(new THREE.CircleGeometry(1,72),new THREE.MeshStandardMaterial({color:'#9aae86',roughness:1}));land.rotation.x=-Math.PI/2;land.receiveShadow=true;scene.add(land);
  const camera=new THREE.PerspectiveCamera(42,1,0.1,10000),controls=new OrbitControls(camera,renderer.domElement);
  controls.maxPolarAngle=Math.PI*0.49;controls.enableDamping=false;controls.minDistance=2;controls.maxDistance=150;
  const ambient=new THREE.HemisphereLight('#e6f2ff','#6e775f',2);scene.add(ambient);
  const sun=new THREE.DirectionalLight('#fff2d8',3);sun.position.set(-30,60,-35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.radius=3;sun.shadow.bias=-0.0005;scene.add(sun,sun.target);
  let walkMode=false;let active=true,signature='',extent=50,center=new THREE.Vector3(),disposed=false;
  const render=()=>{if(active&&!disposed)renderer.render(scene,camera);};
  controls.addEventListener('change',render);
  const walk=(e:KeyboardEvent)=>{if(!active||!walkMode||!['w','a','s','d'].includes(e.key.toLowerCase())||['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName))return;const forward=controls.target.clone().sub(camera.position);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,camera.up);const direction=e.key==='w'?forward:e.key==='s'?forward.negate():e.key==='d'?right:right.negate();camera.position.add(direction);controls.target.add(direction);render();};window.addEventListener('keydown',walk);
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();render();};
  const observer=new ResizeObserver(resize);observer.observe(container);
  const failure=(event:Event)=>{event.preventDefault();active=false;onFailure();};renderer.domElement.addEventListener('webglcontextlost',failure);
  function view(mode:'top'|'axonometric'|'orbit'|'walk'){
    walkMode=mode==='walk';camera.up.set(0,1,0);controls.target.copy(center);
    if(mode==='walk'){camera.position.set(center.x,1.65,center.z+extent*.4);controls.target.copy(camera.position).add(new THREE.Vector3(0,0,-5));controls.maxPolarAngle=Math.PI*.95;controls.update();render();return;}controls.maxPolarAngle=Math.PI*.49;
    const offset=mode==='top'?new THREE.Vector3(0,extent*1.6,0.001):new THREE.Vector3(extent*0.8,extent*1.05,extent*1.15);
    camera.position.copy(center).add(offset);camera.lookAt(center);controls.update();render();
  }
  let contextSeason='summer',lastPlot:{x:number;y:number}[]=[];
  function update(project:Scene,original=false,exteriorFor:(item:Scene['items'][number])=>CatalogExterior|undefined=()=>undefined){
    contextSeason=project.environment.season;lastPlot=project.plot;
    const next=JSON.stringify([project.plot,project.plotHoles,project.plotParts,project.terrain,project.items,project.fences,project.environment,project.coordinates,original,project.items.map(i=>!!exteriorFor(i))]);if(next===signature){render();return;}signature=next;
    disposeObject(content);
    if(validRing(project.plot))for(const [outer,...holes] of parcelPolygons(project)){
      const shape=groundShape(outer);shape.holes=holes.map(h=>new THREE.Path(h.map(p=>new THREE.Vector2(p.x,-p.y))));
      let geometry=new THREE.ShapeGeometry(shape);
      if(project.terrain){const samples=project.terrain.samples,base=samples[0].z,position=geometry.getAttribute('position'),index=geometry.index,vertices:number[]=[];
        const subdivide=(a:number[],b:number[],c:number[],depth:number)=>{if(depth){const mid=(u:number[],v:number[])=>[(u[0]+v[0])/2,(u[1]+v[1])/2],ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);subdivide(a,ab,ca,depth-1);subdivide(ab,b,bc,depth-1);subdivide(ca,bc,c,depth-1);subdivide(ab,bc,ca,depth-1);}else for(const p of [a,b,c])vertices.push(p[0],p[1],terrainHeight(samples,p[0],-p[1])-base);};
        const count=index?index.count:position.count;for(let i=0;i<count;i+=3){const p=[0,1,2].map(j=>{const k=index?index.getX(i+j):i+j;return[position.getX(k),position.getY(k)];});subdivide(p[0],p[1],p[2],2);}geometry.dispose();geometry=new THREE.ShapeGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(null);geometry.computeVertexNormals();}
      const ground=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:seasonalGround[project.environment.season],side:THREE.DoubleSide,roughness:1,transparent:true,opacity:contextActive?.3:1,depthWrite:!contextActive}));ground.userData.parcelGround=true;ground.rotation.x=-Math.PI/2;ground.position.y=-0.015;ground.receiveShadow=true;content.add(ground);
      const boundary=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(outer.map(p=>new THREE.Vector3(p.x,0.03,p.y))),new THREE.LineBasicMaterial({color:'#f4f1e6'}));content.add(boundary);
      // Survey stakes at the boundary corners.
      const stake=new THREE.CylinderGeometry(0.09,0.09,0.6,8),stakeMaterial=new THREE.MeshStandardMaterial({color:'#f2f0ea',roughness:.7});for(const p of outer){const m=new THREE.Mesh(stake,stakeMaterial);m.position.set(p.x,0.3,p.y);m.castShadow=true;content.add(m);}
    }
    // Buildable zone: parcel eroded by the largest house setback (4 m default), drawn as a dashed line.
    if(validRing(project.plot)){const houses=project.items.filter(i=>i.type==='house'),distance=houses.length?Math.max(...houses.map(i=>i.setback)):4;
      try{const dash=new THREE.BoxGeometry(1,.03,.25),paint=new THREE.MeshStandardMaterial({color:'#f2c230',roughness:.6,emissive:'#3d2f00'});for(const [outer] of setbackArea(project,distance).parts)outer.forEach((a,i)=>{const b=outer[(i+1)%outer.length],length=Math.hypot(b.x-a.x,b.y-a.y),angle=Math.atan2(b.y-a.y,b.x-a.x);for(let t=0;t<length;t+=1.4){const l=Math.min(.9,length-t),m=new THREE.Mesh(dash,paint);m.scale.x=l;const c=t+l/2;m.position.set(a.x+(b.x-a.x)*c/length,.04,a.y+(b.y-a.y)*c/length);m.rotation.y=-angle;m.userData.buildableZone=true;content.add(m);}});}catch{/* invalid setback geometry: skip the guide */}
    }
    for(const item of project.items.filter(i=>i.visible)){const object=buildBuilding(item,original,makeTexture,project.environment.season,exteriorFor(item));if(project.terrain)object.position.y=terrainHeight(project.terrain.samples,item.x,item.y)-project.terrain.samples[0].z;content.add(object);}
    for(const fence of project.fences)content.add(buildFence(fence,project.environment.season));
    // The boundary fence follows the main ring; extra parcel parts and inner rings get a matching fence without a gate.
    if(project.fences.some(f=>f.id===BOUNDARY_FENCE_ID))for(const ring of parcelPolygons(project).flat().slice(1)){const f=boundaryFence(ring,-1,'');if(f)content.add(buildFence(f,project.environment.season));}
    content.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(content),size=bounds.getSize(new THREE.Vector3());
    center=bounds.getCenter(new THREE.Vector3());extent=Math.max(size.x,size.z,20);controls.maxDistance=extent*3;// ponytail: zoom-out stops a few parcel widths away, the surroundings tile ends soon after
    const range=extent,env=project.environment,origin=project.coordinates.projected?.origin;
    const [lon,lat]=origin?geographicPoint([origin.x,origin.y]):[env.longitude,env.latitude];
    const position=sunPosition(env.date,lat,lon);sun.target.position.copy(center);sun.position.copy(center).add(new THREE.Vector3(position.direction.x,position.direction.y,position.direction.z).multiplyScalar(range*2));sun.intensity=position.daylight?(env.weather==='clear'?3:1.2):0;ambient.intensity=position.daylight?1.15:.18;
    renderer.setClearColor(position.daylight?'#dce4e7':'#15212f');scene.background=!position.daylight?nightSky:env.weather==='clear'?daySky:greySky;setWeather(env.weather,center,range);scene.fog=env.weather==='clear'?new THREE.Fog(position.daylight?'#e8f2ff':'#1b2838',range*7,range*16):new THREE.Fog('#b7c1c4',range*1.5,range*4);
    land.scale.setScalar(range*18);land.position.set(center.x,-0.08,center.z);(land.material as THREE.MeshStandardMaterial).color.set(seasonalGround[env.season]).lerp(new THREE.Color('#bfe3b0'),.45);
    Object.assign(sun.shadow.camera,{left:-range,right:range,top:range,bottom:-range,near:0.1,far:range*5});sun.shadow.camera.updateProjectionMatrix();
    if(camera.position.length()===0)view('axonometric');render();
    return content.children.some(c=>c.userData.approximateRoof);
  }
  const roofMat=new THREE.MeshStandardMaterial({color:'#8d8a83',roughness:.9});
  /** Trees where the orthophoto shows dark-green canopy outside the parcel and buildings (estimated, one per 4 m cell). */
  function addCanopyTrees(image:CanvasImageSource,ctx:SceneContext){
    const size=256,c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d',{willReadFrequently:true});if(!g)return;
    try{g.drawImage(image,0,0,size,size);}catch{return;}
    let data:Uint8ClampedArray;try{data=g.getImageData(0,0,size,size).data;}catch{return;}// tainted canvas: skip trees
    const cell=ctx.half*2/size,x0=ctx.center.x-ctx.half,y0=ctx.center.y-ctx.half,taken=new Set<string>(),spots:{x:number;y:number;s:number}[]=[];
    const rings=ctx.buildings.map(b=>b.ring),plot=lastPlot;
    for(let py=1;py<size-1;py+=2)for(let px=1;px<size-1;px+=2){
      const i=(py*size+px)*4,r=data[i],gr=data[i+1],b=data[i+2],lum=(r+gr+b)/3;
      if(!(gr>r+6&&gr>=b-4&&lum<105&&lum>18))continue;
      const p={x:x0+(px+.5)*cell,y:y0+(py+.5)*cell},key=`${Math.floor(p.x/4)},${Math.floor(p.y/4)}`;
      if(taken.has(key)||(plot.length>2&&pointLocation(p,plot)!=='outside')||rings.some(r=>pointLocation(p,r)!=='outside'))continue;
      taken.add(key);spots.push({...p,s:.75+((px*7+py*13)%10)/20});if(spots.length>=450)break;
    }
    if(!spots.length)return;
    const crownColor={spring:'#6b9846',summer:'#4b7536',autumn:'#b57138',winter:'#6d6a5c'}[contextSeason]??'#4b7536';
    const crown=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:crownColor,roughness:.95,flatShading:true}),spots.length);
    const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.18,1,6),new THREE.MeshStandardMaterial({color:'#5b4632',roughness:1}),spots.length);
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3();
    spots.forEach((t,i)=>{const h=5.5*t.s+2;m.compose(v.set(t.x,h-1.6*t.s,t.y),q,new THREE.Vector3(2.1*t.s,2.4*t.s,2.1*t.s));crown.setMatrixAt(i,m);m.compose(v.set(t.x,(h-2*t.s)/2,t.y),q,new THREE.Vector3(1,h-2*t.s,1));trunk.setMatrixAt(i,m);});
    crown.castShadow=trunk.castShadow=true;crown.userData.canopy=trunk.userData.canopy=true;contextGroup.add(crown,trunk);
  }
  function setContext(ctx:SceneContext|null){
    disposeObject(contextGroup);contextActive=!!ctx;
    content.traverse(o=>{if(o.userData.parcelGround){const m=(o as THREE.Mesh).material as THREE.MeshStandardMaterial;m.opacity=ctx?.3:1;m.depthWrite=!ctx;}});
    if(!ctx){render();return;}
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(ctx.half*2,ctx.half*2),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1}));
    plane.rotation.x=-Math.PI/2;plane.position.set(ctx.center.x,-0.04,ctx.center.y);plane.receiveShadow=true;contextGroup.add(plane);
    contextReady=new Promise<void>(done=>new THREE.TextureLoader().setCrossOrigin('anonymous').load(ctx.ortho,texture=>{if(disposed||!plane.parent){texture.dispose();done();return;}texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();const m=plane.material as THREE.MeshStandardMaterial;m.map=texture;m.needsUpdate=true;roofMat.map=texture;roofMat.color.set('#ffffff');roofMat.needsUpdate=true;addCanopyTrees(texture.image as CanvasImageSource,ctx);render();done();},undefined,()=>{(plane.material as THREE.MeshStandardMaterial).color.set('#b9c2ad');render();done();}));
    // Neighbours: roofs show the orthophoto projected from above; walls get plaster with window rows in varied tones.
    const span=ctx.half*2,x0=ctx.center.x-ctx.half,y0=ctx.center.y-ctx.half;
    const orthoUV={generateTopUV:(_g:THREE.ExtrudeGeometry,v:number[],a:number,b:number,c:number)=>[a,b,c].map(i=>new THREE.Vector2((v[i*3]-x0)/span,1-(-v[i*3+1]-y0)/span)),
      generateSideWallUV:(_g:THREE.ExtrudeGeometry,v:number[],a:number,b:number,c:number,d:number)=>{const ax=v[a*3],ay=v[a*3+1],bx=v[b*3],by=v[b*3+1],len=Math.hypot(bx-ax,by-ay);return [new THREE.Vector2(0,v[a*3+2]),new THREE.Vector2(len,v[b*3+2]),new THREE.Vector2(len,v[c*3+2]),new THREE.Vector2(0,v[d*3+2])];}};
    const facade=(tone:string)=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');if(g){g.fillStyle=tone;g.fillRect(0,0,64,64);g.fillStyle='rgba(40,52,60,.78)';g.fillRect(20,18,24,22);g.fillStyle='rgba(255,255,255,.55)';g.fillRect(18,40,28,3);}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/3,1/3);return t;};
    const walls=['#ece8df','#e4ddd0','#dfe1df','#efe6d6'].map(tone=>new THREE.MeshStandardMaterial({map:facade(tone),roughness:.85}));
    roofMat.map=null;roofMat.color.set('#8d8a83');
    const edge=new THREE.LineBasicMaterial({color:'#6f6a60',transparent:true,opacity:.6});
    // Existing buildings on the parcel are drawn as a ground outline, so the planned house stays visible.
    for(const b of ctx.buildings.filter(b=>b.onParcel)){const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(b.ring.map(p=>new THREE.Vector3(p.x,.05,p.y))),new THREE.LineDashedMaterial({color:'#b8392a',dashSize:.6,gapSize:.4}));line.computeLineDistances();contextGroup.add(line);}
    ctx.buildings.filter(b=>!b.onParcel).forEach((b,i)=>{const geometry=new THREE.ExtrudeGeometry(groundShape(b.ring),{depth:b.height,bevelEnabled:false,UVGenerator:orthoUV as unknown as THREE.UVGenerator}),mesh=new THREE.Mesh(geometry,[roofMat,walls[i%walls.length]]);mesh.rotation.x=-Math.PI/2;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.contextBuilding=true;
      const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,30),edge);mesh.add(edges);contextGroup.add(mesh);});
    render();
  }
  /** Frame one building from its front-left, at eye-catching height. */
  function focus(item:{x:number;y:number;w:number;d:number;rot:number}){
    walkMode=false;const r=item.rot*Math.PI/180,size=Math.max(item.w,item.d),front=new THREE.Vector3(-Math.sin(r),0,Math.cos(r)),side=new THREE.Vector3(Math.cos(r),0,Math.sin(r));
    const target=new THREE.Vector3(item.x,2.2,item.y);controls.maxPolarAngle=Math.PI*.49;controls.target.copy(target);
    // Prefer the front corners; skip viewpoints whose line of sight is blocked by a neighbouring building.
    const ray=new THREE.Raycaster(),candidates=[[1,-1],[1,1],[-1,-1],[-1,1]].map(([f,sd])=>target.clone().addScaledVector(front,f*size*1.9).addScaledVector(side,sd*size*.7).add(new THREE.Vector3(0,size*.55,0)));
    const blockers=contextGroup.children.filter(c=>c.userData.contextBuilding);
    const clear=candidates.find(p=>{const dir=p.clone().sub(target),far=dir.length();ray.set(target,dir.normalize());ray.far=far;return !ray.intersectObjects(blockers,false).length;})??candidates[0];
    camera.position.copy(clear);camera.lookAt(target);controls.update();render();
  }
  /** Overview plus an optional close-up of one building, without disturbing the user's camera. */
  function snapshots(item?:{x:number;y:number;w:number;d:number;rot:number}){
    const position=camera.position.clone(),target=controls.target.clone(),walking=walkMode,shots:{kind:'overview'|'house';src:string}[]=[];
    view('axonometric');shots.push({kind:'overview',src:renderer.domElement.toDataURL('image/png')});
    if(item){focus(item);shots.push({kind:'house',src:renderer.domElement.toDataURL('image/png')});}
    walkMode=walking;camera.position.copy(position);controls.target.copy(target);controls.update();render();return shots;
  }
  return {update,view,setContext,focus,snapshots,ready:()=>contextReady,
    setActive(value:boolean){active=value;if(value)resize();},
    quality(low:boolean){renderer.setPixelRatio(low?1:Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=!low;resize();},
    screenshot(){render();return renderer.domElement.toDataURL('image/png');},
    dispose(){window.removeEventListener('keydown',walk);disposed=true;observer.disconnect();controls.dispose();disposeObject(content);sun.shadow.dispose();renderer.domElement.removeEventListener('webglcontextlost',failure);if(frame)cancelAnimationFrame(frame);setWeather('clear',center,1);greySky.dispose();disposeObject(contextGroup);roofMat.dispose();land.geometry.dispose();(land.material as THREE.Material).dispose();daySky.dispose();nightSky.dispose();renderer.dispose();renderer.domElement.remove();},
    memory(){return {...renderer.info.memory};},
  };
}
