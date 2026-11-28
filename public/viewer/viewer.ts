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
  const daySky=sky('#5ea8ff','#e8f2ff'),nightSky=sky('#070d16','#1b2838'),greySky=sky('#7f8b95','#cdd3d6'),rainSky=sky('#4a5560','#8d979d'),snowSky=sky('#aab4bd','#eef1f3');
  // Rain and snow particles around the parcel; animated only while visible.
  let weatherFx:THREE.LineSegments|THREE.Points|null=null,weatherKind='clear',weatherBox=new THREE.Box3(),frame=0,last=0;
  function setWeather(kind:string,center:THREE.Vector3,range:number){
    if(weatherFx){scene.remove(weatherFx);weatherFx.geometry.dispose();(weatherFx.material as THREE.Material).dispose();weatherFx=null;}
    weatherKind=kind;if(kind!=='rain'&&kind!=='snow')return;
    const half=Math.min(range*1.4,120),count=kind==='rain'?9000:7000,top=30,pos=new Float32Array(count*(kind==='rain'?6:3));
    weatherBox=new THREE.Box3(new THREE.Vector3(center.x-half,0,center.z-half),new THREE.Vector3(center.x+half,top,center.z+half));
    for(let i=0;i<count;i++){const x=center.x+(Math.random()*2-1)*half,y=Math.random()*top,z=center.z+(Math.random()*2-1)*half;if(kind==='rain'){pos.set([x,y,z,x+.18,y+1.1,z],i*6);}else pos.set([x,y,z],i*3);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));
    weatherFx=kind==='rain'?new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#d6e2ef',transparent:true,opacity:.8})):new THREE.Points(geometry,new THREE.PointsMaterial({color:'#ffffff',size:.26,transparent:true,opacity:.95,depthWrite:false}));
    weatherFx.frustumCulled=false;scene.add(weatherFx);if(!frame)frame=requestAnimationFrame(tick);
  }
  function tick(now:number){
    frame=0;if(disposed||!weatherFx)return;if(!active){frame=requestAnimationFrame(tick);return;}
    const dt=Math.min(.05,(now-(last||now))/1000),attr=weatherFx.geometry.getAttribute('position') as THREE.BufferAttribute,a=attr.array as Float32Array,rain=weatherKind==='rain',step=rain?6:3,fall=(rain?18:1.1)*dt,{min,max}=weatherBox;last=now;
    for(let i=0;i<a.length;i+=step){a[i+1]-=fall;if(rain){a[i+4]-=fall;a[i]-=fall*.16;a[i+3]-=fall*.16;}else{a[i]+=Math.sin(now/900+i)*.006;}if(a[i+1]<0){const y=max.y;a[i+1]=y;if(rain)a[i+4]=y+1.1;}if(a[i]<min.x||a[i]>max.x){a[i]=min.x+Math.random()*(max.x-min.x);if(rain)a[i+3]=a[i]+.18;}}// rain falls along its wind slant
    attr.needsUpdate=true;draw();frame=requestAnimationFrame(tick);
  }
  const contextGroup=new THREE.Group();scene.add(contextGroup);let contextActive=false,contextReady:Promise<void>=Promise.resolve();
  const land=new THREE.Mesh(new THREE.CircleGeometry(1,72),new THREE.MeshStandardMaterial({color:'#9aae86',roughness:1}));land.userData.ground=true;land.rotation.x=-Math.PI/2;land.receiveShadow=true;scene.add(land);
  const camera=new THREE.PerspectiveCamera(42,1,0.1,10000),controls=new OrbitControls(camera,renderer.domElement);
  controls.maxPolarAngle=Math.PI*0.49;controls.enableDamping=false;controls.minDistance=2;controls.maxDistance=150;
  const ambient=new THREE.HemisphereLight('#e6f2ff','#6e775f',2);scene.add(ambient);
  const sun=new THREE.DirectionalLight('#fff2d8',3);sun.position.set(-30,60,-35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.radius=3;sun.shadow.bias=-0.0005;scene.add(sun,sun.target);
  let mode:'top'|'axonometric'|'orbit'|'interior'|'walk'='axonometric';let active=true,signature='',extent=50,center=new THREE.Vector3(),disposed=false;
  // White model by default: every mesh is swapped to a plain white material only for the draw call, so the scene's own
  // materials are never touched. userData.plainColour keeps an accent (setback line, boundary, tree crowns).
  let plain=true;const plainMats=new Map<string,THREE.Material>(),plainSky=sky('#ffffff','#e9edf4'),plainFog=new THREE.Fog('#eef1f6',1,2);
  const plainFor=(m:THREE.Material,o:THREE.Object3D)=>{
    const tint=o.userData.plainColour as string|undefined,line=(o as THREE.Line).isLine,dashed=m instanceof THREE.LineDashedMaterial;
    if(line&&!tint)return m;
    const colour=tint??(o.userData.ground?'#eceff5':'#ffffff'),key=`${colour}|${line}|${dashed}|${m.transparent}|${m.opacity}|${m.side}`;
    let out=plainMats.get(key);
    if(!out){out=line?(dashed?new THREE.LineDashedMaterial({color:colour,dashSize:.6,gapSize:.4}):new THREE.LineBasicMaterial({color:colour})):new THREE.MeshStandardMaterial({color:colour,roughness:.92,transparent:m.transparent,opacity:m.opacity,side:m.side,depthWrite:m.depthWrite});plainMats.set(key,out);}
    return out;
  };
  function draw(){
    if(!plain&&mode!=='interior'&&mode!=='walk'){renderer.render(scene,camera);return;}// the interior always uses the landing's white model with orange accents
    const swapped:[THREE.Mesh,THREE.Material|THREE.Material[]][]=[],bg=scene.background,fog=scene.fog;
    scene.traverse(o=>{const m=o as THREE.Mesh;if(!m.material||o===weatherFx)return;swapped.push([m,m.material]);m.material=Array.isArray(m.material)?m.material.map(x=>plainFor(x,o)):plainFor(m.material,o);});
    scene.background=plainSky;if(fog instanceof THREE.Fog){plainFog.near=fog.near*2;plainFog.far=fog.far*2;}scene.fog=plainFog;renderer.toneMappingExposure=1.5;// ACES greys a white surface; lift it back to paper
    renderer.render(scene,camera);
    for(const [m,material] of swapped)m.material=material;scene.background=bg;scene.fog=fog;renderer.toneMappingExposure=1.1;
  }
  const render=()=>{if(active&&!disposed)draw();};
  controls.addEventListener('change',render);
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();render();};
  const observer=new ResizeObserver(resize);observer.observe(container);
  const failure=(event:Event)=>{event.preventDefault();active=false;onFailure();};renderer.domElement.addEventListener('webglcontextlost',failure);
  /** Ground-floor walls of a catalogue house as real 3D walls on a floor slab: the top view shows them with the outer walls
   *  as thick boxes; the interior view and the walk-through keep the real outer walls (with window holes) and only lift the roof. */
  const interiorWall=new THREE.MeshStandardMaterial({color:'#f4f0e8',roughness:.9}),interiorFloor=new THREE.MeshStandardMaterial({color:'#ebe5da',roughness:.9}),interiorCap=new THREE.MeshStandardMaterial({color:'#ff6a00',roughness:.6});
  function interiorWalls(item:{w:number;d:number},walls:number[][]){
    const group=new THREE.Group(),height=2.7;group.userData.floorPlan=true;group.userData.walls=walls.map(([x0,y0,x1,y1,t=.14])=>[x0-item.w/2,y0-item.d/2,x1-item.w/2,y1-item.d/2,t]);
    const floor=new THREE.Mesh(new THREE.BoxGeometry(item.w,.06,item.d),interiorFloor);floor.position.y=.03;floor.userData.plainColour='#a3927a';group.add(floor);
    const ceiling=new THREE.Mesh(new THREE.BoxGeometry(item.w,.04,item.d),interiorWall);ceiling.position.y=height+.02;ceiling.userData.ceiling=true;ceiling.userData.plainColour='#f4f1ea';group.add(ceiling);// only inside the walk-through
    for(const [x0,y0,x1,y1,t=.14] of walls){const len=Math.hypot(x1-x0,y1-y0),along=Math.abs(x1-x0)>=Math.abs(y1-y0);
      const wall=new THREE.Mesh(new THREE.BoxGeometry(along?len+t:t,height,along?t:len+t),interiorWall);
      wall.position.set((x0+x1)/2-item.w/2,height/2,(y0+y1)/2-item.d/2);wall.userData.shell=t>=.3;wall.userData.plainColour='#fcfaf5';group.add(wall);
      if(t<.3){const skirt=new THREE.Mesh(new THREE.BoxGeometry(along?len+t+.02:t+.02,.1,along?t+.02:len+t+.02),interiorWall);skirt.position.set(wall.position.x,.11,wall.position.z);skirt.userData.plainColour='#5f6862';group.add(skirt);}
      // Orange cap on each wall top: from above the rooms read as an orange floor plan, like the landing animation.
      const cap=new THREE.Mesh(new THREE.BoxGeometry(along?len+t:t,.02,along?t:len+t),interiorCap);cap.position.set(wall.position.x,height+.01,wall.position.z);cap.userData.cap=true;cap.userData.plainColour='#ff6a00';group.add(cap);}// no shadows: rooms stay readable from above
    return group;
  }
  function applyCutaway(){const top=mode==='top',open=mode==='interior'||mode==='walk';content.traverse(o=>{const u=o.userData;
    if(u.roofEquipment||u.roof||o.name==='roof')o.visible=!top&&!open;
    else if(u.shell)o.visible=top;
    else if(u.ceiling)o.visible=mode==='walk';
    else if(u.cap)o.visible=open&&mode!=='walk'||top;
    else if(u.floorPlan)o.visible=top||open;
    else if(o.name==='exterior'||(o.name.startsWith('wall-')&&o.parent?.children.some(c=>c.userData.floorPlan)))o.visible=!top;});}
  type Target={id:string;x:number;y:number;w:number;d:number;rot:number};
  // Camera flights between views: eased position and look-at; the orbit controls wait until the camera lands.
  let flight=0;
  function fly(to:THREE.Vector3,look:THREE.Vector3,ms:number,done?:()=>void){
    cancelAnimationFrame(flight);const from=camera.position.clone(),fromLook=controls.target.clone(),start=performance.now();controls.enabled=false;
    const step=(now:number)=>{const k=Math.min(1,(now-start)/ms),e=k<.5?4*k*k*k:1-(-2*k+2)**3/2;
      camera.position.lerpVectors(from,to,e);controls.target.lerpVectors(fromLook,look,e);camera.lookAt(controls.target);render();
      if(k<1)flight=requestAnimationFrame(step);else{flight=0;if(done)done();else{controls.enabled=true;controls.update();}}};
    flight=requestAnimationFrame(step);
  }
  function view(next:'top'|'axonometric'|'orbit'|'interior'|'walk',item?:Target){
    if(item)lastTarget=item;if(mode==='walk'&&next!=='walk')leaveWalk();
    mode=next;applyCutaway();camera.up.set(0,1,0);controls.maxPolarAngle=Math.PI*.49;
    const root=item&&content.getObjectByName(item.id);
    if(next==='walk'){enterWalk(root??undefined);return;}
    if(next==='interior'&&root){
      // Roof lifted off, looking down into the rooms from the front-left, close enough to read the layout.
      const r=-root.rotation.y,size=Math.max(item!.w,item!.d),look=root.position.clone().setY(root.position.y+.6);
      const to=look.clone().add(new THREE.Vector3(-Math.sin(r)*-.55+Math.cos(r)*-.45,0,Math.cos(r)*.55+Math.sin(r)*-.45).multiplyScalar(size*1.5)).setY(root.position.y+size*1.25);
      fly(to,look,1100);return;
    }
    cancelAnimationFrame(flight);flight=0;controls.enabled=true;controls.target.copy(center);
    const offset=next==='top'?new THREE.Vector3(0,extent*1.6,0.001):new THREE.Vector3(extent*0.8,extent*1.05,extent*1.15);
    camera.position.copy(center).add(offset);camera.lookAt(center);controls.update();render();
  }
  // ---------- first-person walk-through ----------
  // Eye at 1.6 m, drag to look, WASD/arrows (Shift runs) or the on-screen pad, Esc leaves. The plan's walls stop you;
  // doorways (gaps between transcribed wall segments) let you through. Walls are segments [x0,z0,x1,z1,thickness] in world metres.
  const EYE=1.6,RADIUS=.22,pl=()=>document.documentElement.lang==='pl';
  let yaw=0,pitch=0,floorY=0,walls:number[][]=[],openings:[number,number,number,number,string][]=[],walkLoop=0,lastStep=0,bob=0,hud:HTMLElement|null=null,mini:HTMLCanvasElement|null=null,miniBox={x:0,z:0,s:1};
  const keys=new Set<string>(),pad={x:0,z:0},lamp=new THREE.PointLight('#fff1dc',0,10,1.4);scene.add(lamp);// soft fill that walks with you: rooms in the sun's shadow stay readable
  const nearest=(x:number,z:number,[x0,z0,x1,z1]:number[])=>{const dx=x1-x0,dz=z1-z0,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-x0)*dx+(z-z0)*dz)/l)):0;return [x0+dx*t,z0+dz*t];};
  const clearance=(x:number,z:number,list=walls)=>list.reduce((m,w)=>{const [cx,cz]=nearest(x,z,w);return Math.min(m,Math.hypot(x-cx,z-cz)-w[4]/2);},Infinity);
  function collide(p:THREE.Vector3){for(let i=0;i<3;i++)for(const w of walls){const [cx,cz]=nearest(p.x,p.z,w),dx=p.x-cx,dz=p.z-cz,d=Math.hypot(dx,dz),min=RADIUS+w[4]/2;if(d<min&&d>1e-6){p.x+=dx/d*(min-d);p.z+=dz/d*(min-d);}}}
  function enterWalk(root?:THREE.Object3D){
    const plan=root?.children.find(c=>c.userData.floorPlan);
    walls=plan?(plan.userData.walls as number[][]).map(([x0,z0,x1,z1,t])=>{root!.updateMatrixWorld(true);const a=root!.localToWorld(new THREE.Vector3(x0,0,z0)),b=root!.localToWorld(new THREE.Vector3(x1,0,z1));return [a.x,a.z,b.x,b.z,t];}):[];
    floorY=root?root.position.y+.06:0;
    openings=(root?.children??[]).filter(c=>c.userData.span).map(c=>{const [x0,z0,x1,z1,k]=c.userData.span,a=root!.localToWorld(new THREE.Vector3(x0,0,z0)),b=root!.localToWorld(new THREE.Vector3(x1,0,z1));return [a.x,a.z,b.x,b.z,k];});
    let spot=new THREE.Vector3(center.x,0,center.z+extent*.4);yaw=0;
    if(plan){
      // Start in the most open spot (usually the living room), facing the longest clear line of sight. Searched in the
      // house's own axes: a rotated house's world bounding box has open corners outside its walls.
      const local=plan.userData.walls as number[][],xs=local.flatMap(w=>[w[0],w[2]]),zs=local.flatMap(w=>[w[1],w[3]]);let best=-1,at=new THREE.Vector3();
      for(let x=Math.min(...xs)+.5;x<Math.max(...xs)-.5;x+=.2)for(let z=Math.min(...zs)+.5;z<Math.max(...zs)-.5;z+=.2){const c=clearance(x,z,local);if(c>best){best=c;at=new THREE.Vector3(x,0,z);}}
      let far=0,localYaw=0;for(let a=0;a<Math.PI*2;a+=Math.PI/24){let t=.3;while(t<25&&clearance(at.x-Math.sin(a)*t,at.z-Math.cos(a)*t,local)>RADIUS)t+=.15;if(t>far){far=t;localYaw=a;}}
      spot=root!.localToWorld(at);yaw=localYaw+root!.rotation.y;
    }
    spot.y=floorY+EYE;pitch=-.06;
    const look=spot.clone().add(new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)));
    // Swoop down from wherever the camera is, then hand over to the walking controls.
    ambient.groundColor.set('#e2d6c4');showHud();fly(spot,look,1400,()=>{camera.position.copy(spot);lastStep=0;walkLoop=requestAnimationFrame(walkStep);});
  }
  function leaveWalk(){lamp.intensity=0;ambient.groundColor.set('#6e775f');cancelAnimationFrame(walkLoop);walkLoop=0;keys.clear();pad.x=pad.z=0;hud?.remove();hud=mini=null;controls.enabled=true;}
  function walkStep(now:number){
    walkLoop=0;if(mode!=='walk'||disposed)return;walkLoop=requestAnimationFrame(walkStep);if(!active)return;
    const dt=Math.min(.05,(now-(lastStep||now))/1000);lastStep=now;
    const f=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)+pad.z,sd=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+pad.x;
    const moving=f!==0||sd!==0,speed=keys.has('shift')?3.2:1.5,p=camera.position;
    if(moving){const l=Math.hypot(f,sd);p.x+=(-Math.sin(yaw)*f+Math.cos(yaw)*sd)/l*speed*dt;p.z+=(-Math.cos(yaw)*f-Math.sin(yaw)*sd)/l*speed*dt;collide(p);bob+=dt*speed*5.5;}
    p.y=floorY+EYE+Math.sin(bob)*.025;lamp.position.set(p.x+Math.sin(yaw)*.8,floorY+2.2,p.z+Math.cos(yaw)*.8);lamp.intensity=10;camera.rotation.set(pitch,yaw,0,'YXZ');draw();drawMini();
  }
  function drawMini(){
    const g=mini?.getContext('2d');if(!g||!walls.length)return;const {x,z,s}=miniBox,W=mini!.width,H=mini!.height;g.clearRect(0,0,W,H);
    g.strokeStyle='#9aa39b';g.lineCap='round';for(const w of walls){g.lineWidth=Math.max(1.5,w[4]*s);g.beginPath();g.moveTo((w[0]-x)*s,(w[1]-z)*s);g.lineTo((w[2]-x)*s,(w[3]-z)*s);g.stroke();}
    for(const o of openings){g.strokeStyle=o[4]==='door'?'#ff6a00':o[4]==='garage'?'#a7aea8':'#4f8fbf';g.lineWidth=o[4]==='door'?5:3.5;g.beginPath();g.moveTo((o[0]-x)*s,(o[1]-z)*s);g.lineTo((o[2]-x)*s,(o[3]-z)*s);g.stroke();}
    const px=(camera.position.x-x)*s,pz=(camera.position.z-z)*s;g.fillStyle='rgba(255,106,0,.22)';g.beginPath();g.moveTo(px,pz);g.arc(px,pz,26,-Math.PI/2-yaw-.6,-Math.PI/2-yaw+.6);g.closePath();g.fill();
    g.fillStyle='#ff6a00';g.beginPath();g.arc(px,pz,5,0,Math.PI*2);g.fill();
  }
  function showHud(){
    hud?.remove();hud=document.createElement('div');hud.className='walk-hud';
    const t=(en:string,p:string)=>pl()?p:en;
    hud.innerHTML=`<div class="walk-tip">${t('Drag to look around · W A S D or arrows to walk · Shift to run · scroll out to leave the house','Przeciągnij, by się rozejrzeć · W A S D lub strzałki, by iść · Shift — szybciej · przewiń, by wyjść z domu')}</div><button type="button" class="walk-exit">${t('Leave walk-through','Zakończ spacer')} <kbd>Esc</kbd></button><canvas class="walk-map" width="180" height="120" aria-hidden="true"></canvas><div class="walk-pad" aria-hidden="true"><button data-pad="0,1">▲</button><button data-pad="-1,0">◀</button><button data-pad="1,0">▶</button><button data-pad="0,-1">▼</button></div>`;
    hud.querySelector<HTMLButtonElement>('.walk-exit')!.onclick=()=>view('interior',lastTarget);
    hud.querySelectorAll<HTMLButtonElement>('[data-pad]').forEach(b=>{const [x,z]=b.dataset.pad!.split(',').map(Number);
      b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);pad.x=x;pad.z=z;};b.onpointerup=b.onpointercancel=()=>{pad.x=pad.z=0;};});
    mini=hud.querySelector('canvas');
    if(walls.length){const xs=walls.flatMap(w=>[w[0],w[2]]),zs=walls.flatMap(w=>[w[1],w[3]]),w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs),s=Math.min(164/w,104/d);miniBox={x:Math.min(...xs)-(180/s-w)/2,z:Math.min(...zs)-(120/s-d)/2,s};}else mini!.hidden=true;
    container.append(hud);
  }
  let lastTarget:Target|undefined,dragging:{x:number;y:number}|null=null;
  renderer.domElement.addEventListener('pointerdown',e=>{if(mode!=='walk'||flight)return;dragging={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});
  renderer.domElement.addEventListener('pointermove',e=>{if(!dragging)return;yaw+=(e.clientX-dragging.x)*.0045;pitch=Math.max(-1.2,Math.min(1.2,pitch+(e.clientY-dragging.y)*.0045));dragging={x:e.clientX,y:e.clientY};});
  renderer.domElement.addEventListener('wheel',e=>{if(mode==='walk'&&!flight&&e.deltaY>0){e.preventDefault();view('interior',lastTarget);}},{passive:false});
  const touches=new Map<number,{x:number;y:number}>();let pinch=0;
  renderer.domElement.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')touches.set(e.pointerId,{x:e.clientX,y:e.clientY});});
  renderer.domElement.addEventListener('pointermove',e=>{if(!touches.has(e.pointerId))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size!==2||mode!=='walk')return;const [a,b]=[...touches.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(!pinch)pinch=d;else if(d<pinch*.75){pinch=0;touches.clear();dragging=null;view('interior',lastTarget);}});
  const endTouch=(e:PointerEvent)=>{touches.delete(e.pointerId);pinch=0;};renderer.domElement.addEventListener('pointerup',endTouch);renderer.domElement.addEventListener('pointercancel',endTouch);
  const endDrag=()=>{dragging=null;};renderer.domElement.addEventListener('pointerup',endDrag);renderer.domElement.addEventListener('pointercancel',endDrag);
  const typing=(e:KeyboardEvent)=>['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName);
  const keyDown=(e:KeyboardEvent)=>{if(mode!=='walk'||!active||typing(e))return;const k=e.key.toLowerCase();if(k==='escape'){view('interior',lastTarget);return;}if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(k)){keys.add(k);e.preventDefault();}};
  const keyUp=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',()=>keys.clear());
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
      const ground=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:seasonalGround[project.environment.season],side:THREE.DoubleSide,roughness:1,transparent:true,opacity:contextActive?.3:1,depthWrite:!contextActive}));ground.userData.parcelGround=ground.userData.ground=true;ground.rotation.x=-Math.PI/2;ground.position.y=-0.015;ground.receiveShadow=true;content.add(ground);
      const boundary=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(outer.map(p=>new THREE.Vector3(p.x,0.03,p.y))),new THREE.LineBasicMaterial({color:'#f4f1e6'}));boundary.userData.plainColour='#3b5bdb';content.add(boundary);
      // Survey stakes at the boundary corners.
      const stake=new THREE.CylinderGeometry(0.09,0.09,0.6,8),stakeMaterial=new THREE.MeshStandardMaterial({color:'#f2f0ea',roughness:.7});for(const p of outer){const m=new THREE.Mesh(stake,stakeMaterial);m.position.set(p.x,0.3,p.y);m.castShadow=true;content.add(m);}
    }
    // Buildable zone: parcel eroded by the largest house setback (4 m default), drawn as a dashed line.
    if(validRing(project.plot)){const houses=project.items.filter(i=>i.type==='house'),distance=houses.length?Math.max(...houses.map(i=>i.setback)):4;
      try{const dash=new THREE.BoxGeometry(1,.03,.25),paint=new THREE.MeshStandardMaterial({color:'#f2c230',roughness:.6,emissive:'#3d2f00'});for(const [outer] of setbackArea(project,distance).parts)outer.forEach((a,i)=>{const b=outer[(i+1)%outer.length],length=Math.hypot(b.x-a.x,b.y-a.y),angle=Math.atan2(b.y-a.y,b.x-a.x);for(let t=0;t<length;t+=1.4){const l=Math.min(.9,length-t),m=new THREE.Mesh(dash,paint);m.scale.x=l;const c=t+l/2;m.position.set(a.x+(b.x-a.x)*c/length,.04,a.y+(b.y-a.y)*c/length);m.rotation.y=-angle;m.userData.buildableZone=true;m.userData.plainColour='#4c6ef5';content.add(m);}});}catch{/* invalid setback geometry: skip the guide */}
    }
    for(const item of project.items.filter(i=>i.visible)){const exterior=exteriorFor(item),object=buildBuilding(item,original,makeTexture,project.environment.season,exterior);if(project.terrain)object.position.y=terrainHeight(project.terrain.samples,item.x,item.y)-project.terrain.samples[0].z;if(exterior?.interior&&item.shape==='rectangle')object.add(interiorWalls(item,exterior.interior.walls));content.add(object);}
    applyCutaway();
    for(const fence of project.fences)content.add(buildFence(fence,project.environment.season));
    // The boundary fence follows the main ring; extra parcel parts and inner rings get a matching fence without a gate.
    if(project.fences.some(f=>f.id===BOUNDARY_FENCE_ID))for(const ring of parcelPolygons(project).flat().slice(1)){const f=boundaryFence(ring,-1,'');if(f)content.add(buildFence(f,project.environment.season));}
    content.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(content),size=bounds.getSize(new THREE.Vector3());
    center=bounds.getCenter(new THREE.Vector3());extent=Math.max(size.x,size.z,20);controls.maxDistance=extent*3;// ponytail: zoom-out stops a few parcel widths away, the surroundings tile ends soon after
    const range=extent,env=project.environment,origin=project.coordinates.projected?.origin;
    const [lon,lat]=origin?geographicPoint([origin.x,origin.y]):[env.longitude,env.latitude];
    const position=sunPosition(env.date,lat,lon);sun.target.position.copy(center);sun.position.copy(center).add(new THREE.Vector3(position.direction.x,position.direction.y,position.direction.z).multiplyScalar(range*2));sun.intensity=position.daylight?({clear:3,clouds:1,rain:.45,snow:1.3}[env.weather]??3):0;ambient.intensity=position.daylight?(env.weather==='rain'?.75:1.15):.18;
    renderer.setClearColor(position.daylight?'#dce4e7':'#15212f');scene.background=!position.daylight?nightSky:({clear:daySky,clouds:greySky,rain:rainSky,snow:snowSky}[env.weather]??greySky);setWeather(env.weather,center,range);
    // Weather reads at a glance: rain darkens and wets the ground under a low sky, snow whitens it, clouds flatten the light.
    scene.fog=env.weather==='clear'?new THREE.Fog(position.daylight?'#e8f2ff':'#1b2838',range*7,range*16):new THREE.Fog({clear:'#c3cacd',clouds:'#c3cacd',rain:'#8d979d',snow:'#e6ebee'}[env.weather]??'#c3cacd',range*1.2,range*(env.weather==='clouds'?6:3.2));
    const weatherGround=(c:THREE.Color)=>env.weather==='rain'?c.multiplyScalar(.68):env.weather==='snow'?c.lerp(new THREE.Color('#f3f6f8'),.8):c;
    content.traverse(o=>{if(o.userData.parcelGround)weatherGround(((o as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(seasonalGround[env.season]));});
    land.scale.setScalar(range*18);land.position.set(center.x,-0.08,center.z);weatherGround((land.material as THREE.MeshStandardMaterial).color.set(seasonalGround[env.season]).lerp(new THREE.Color('#bfe3b0'),.45));
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
    crown.castShadow=trunk.castShadow=true;crown.userData.canopy=trunk.userData.canopy=true;crown.userData.plainColour='#6d8cf7';contextGroup.add(crown,trunk);
  }
  function setContext(ctx:SceneContext|null){
    disposeObject(contextGroup);contextActive=!!ctx;
    content.traverse(o=>{if(o.userData.parcelGround){const m=(o as THREE.Mesh).material as THREE.MeshStandardMaterial;m.opacity=ctx?.3:1;m.depthWrite=!ctx;}});
    if(!ctx){render();return;}
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(ctx.half*2,ctx.half*2),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1}));
    plane.rotation.x=-Math.PI/2;plane.position.set(ctx.center.x,-0.04,ctx.center.y);plane.receiveShadow=plane.userData.ground=true;contextGroup.add(plane);
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
    addContextFences(ctx.fences??[]);
  }
  /** Neighbours' property lines get the same panel fence as ours (estimated: the registry shows lines, not fences). */
  function addContextFences(segments:[{x:number;y:number},{x:number;y:number}][]){
    if(contextActive)segments.forEach(([a,b],i)=>contextGroup.add(buildFence({id:'neighbour-'+i,name:'',type:'metal-panel',path:[a,b],height:1.5,width:.08,spacing:2.5,color:'#3a3d41',foundation:.3,maturity:1,gate:null},contextSeason)));
    render();
  }
  /** Frame one building from its front-left, at eye-catching height. */
  function focus(item:{x:number;y:number;w:number;d:number;rot:number}){
    if(mode==='walk')leaveWalk();cancelAnimationFrame(flight);flight=0;controls.enabled=true;mode='orbit';applyCutaway();const r=item.rot*Math.PI/180,size=Math.max(item.w,item.d),front=new THREE.Vector3(-Math.sin(r),0,Math.cos(r)),side=new THREE.Vector3(Math.cos(r),0,Math.sin(r));
    const target=new THREE.Vector3(item.x,2.2,item.y);controls.maxPolarAngle=Math.PI*.49;controls.target.copy(target);
    // Prefer the front corners; skip viewpoints whose line of sight is blocked by a neighbouring building.
    const ray=new THREE.Raycaster(),candidates=[[1,-1],[1,1],[-1,-1],[-1,1]].map(([f,sd])=>target.clone().addScaledVector(front,f*size*1.9).addScaledVector(side,sd*size*.7).add(new THREE.Vector3(0,size*.55,0)));
    const blockers=contextGroup.children.filter(c=>c.userData.contextBuilding);
    const clear=candidates.find(p=>{const dir=p.clone().sub(target),far=dir.length();ray.set(target,dir.normalize());ray.far=far;return !ray.intersectObjects(blockers,false).length;})??candidates[0];
    camera.position.copy(clear);camera.lookAt(target);controls.update();render();
  }
  /** Overview plus an optional close-up of one building, without disturbing the user's camera. */
  function snapshots(item?:{x:number;y:number;w:number;d:number;rot:number}){
    const position=camera.position.clone(),target=controls.target.clone(),quaternion=camera.quaternion.clone(),was=mode,shots:{kind:'overview'|'house';src:string}[]=[];
    if(was==='walk')mode='orbit';// keep the walk HUD; the loop restarts below
    view('axonometric');shots.push({kind:'overview',src:renderer.domElement.toDataURL('image/png')});
    if(item){focus(item);shots.push({kind:'house',src:renderer.domElement.toDataURL('image/png')});}
    mode=was;applyCutaway();camera.position.copy(position);controls.target.copy(target);if(was==='walk'){controls.enabled=false;camera.quaternion.copy(quaternion);if(!walkLoop)walkLoop=requestAnimationFrame(walkStep);}else controls.update();render();return shots;
  }
  return {update,view,setContext,addContextFences,focus,snapshots,ready:()=>contextReady,
    setPlain(value:boolean){plain=value;render();},
    setActive(value:boolean){active=value;if(value)resize();},
    quality(low:boolean){renderer.setPixelRatio(low?1:Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=!low;resize();},
    screenshot(){render();return renderer.domElement.toDataURL('image/png');},
    dispose(){leaveWalk();cancelAnimationFrame(flight);window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);disposed=true;observer.disconnect();controls.dispose();disposeObject(content);sun.shadow.dispose();renderer.domElement.removeEventListener('webglcontextlost',failure);if(frame)cancelAnimationFrame(frame);setWeather('clear',center,1);greySky.dispose();rainSky.dispose();interiorWall.dispose();interiorFloor.dispose();interiorCap.dispose();snowSky.dispose();plainSky.dispose();plainMats.forEach(m=>m.dispose());disposeObject(contextGroup);roofMat.dispose();land.geometry.dispose();(land.material as THREE.Material).dispose();daySky.dispose();nightSky.dispose();renderer.dispose();renderer.domElement.remove();},
    memory(){return {...renderer.info.memory};},
  };
}
