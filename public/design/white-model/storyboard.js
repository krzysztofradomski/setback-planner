/* global window, console, document, Image, requestAnimationFrame */
// Design preview only. The same deterministic scene can drive the approved hero.
import * as THREE from 'three';
window.THREE = THREE;
await import('./stage.js');
const K = window.K;
console.info('Storyboard: renderer loaded');
const beats = [
  {time:1.4,range:'00.0–02.4 s',title:'01 / Twoja działka',caption:'01  DZIAŁKA',move:'Pomarańczowa linia obiega granicę na białej, frezowanej planszy. Budynki pozostają nieruchome.',camera:'Niski kadr ¾; początek jednego ciągłego podjazdu kamery.',sound:'Cichy szelest papieru; miękkie kliknięcie w narożniku.'},
  {time:4.1,range:'02.4–04.8 s',title:'02 / Dom na swoim miejscu',caption:'02  DOM',move:'Akcent dochodzi do obrysu DE 105 i zaznacza jego podstawę. Cienki odnośnik nazywa dom.',camera:'Kamera powoli unosi się i odsuwa; ten sam model i ta sama plansza.',sound:'Krótki, matowy stuk kartonu przy dotarciu do obrysu.'},
  {time:6.6,range:'04.8–07.4 s',title:'03 / Miejsce na więcej',caption:'03  WIATA / GARAŻ',move:'Światło obiega obrys wiaty, podkreślając dodatkową powierzchnię na działce. Garaż jest alternatywą w konfiguratorze.',camera:'Dalszy, płynny podjazd odsłania dojazd i cały obrys dodatku.',sound:'Dwa delikatne kliknięcia; krótka przerwa przed następnym akcentem.'},
  {time:9.7,range:'07.4–11.0 s',title:'04 / Twój wariant domu',caption:'04  WYBRANE DODATKI',move:'Ślad dociera do paneli i pompy ciepła; instalacje otrzymują dyskretny akcent. Gotowy układ pozostaje w kadrze przez ostatnią sekundę.',camera:'Pełna makieta w kadrze; kamera łagodnie zatrzymuje się.',sound:'Cichy ton elektryczny, krótki szum wentylatora, miękkie domknięcie.'},
];
const style = {
  duration:11, fonts:['600 30px "IBM Plex Mono"','500 38px "Inter"'],
  render:{samples:16,shutter:0,tone:'neutral',exposure:1,bloom:.22,bloomThreshold:1.1,vignette:.2,grain:.006,contrast:1.04,fov:29,background:'#b4b8bd'},
  build(S){
    const {scene,camera}=S;
    const grain=K.canvasTex(128,128,(ctx,w,h)=>{const r=K.rng(3),im=ctx.createImageData(w,h);for(let i=0;i<w*h;i++){const v=128+r.gauss()*24;im.data.set([v,v,v,255],i*4);}ctx.putImageData(im,0,0);},{data:true,repeat:[3,3]});
    const white=(color,roughness=.92)=>new THREE.MeshStandardMaterial({color,roughness,bumpMap:grain,bumpScale:.025});
    const M={card:white('#f8f6f0'),foam:white('#eef3f8',.8),paper:white('#fcfbf8'),plaster:white('#eeebe6'),glass:white('#d9e0df',.6)};
    const mesh=(geo,mat,pos=[0,0,0],rot=[0,0,0])=>{const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.rotation.set(...rot);m.castShadow=m.receiveShadow=true;scene.add(m);return m;};
    const box=(w,h,d,mat,pos,rot)=>mesh(K.roundedBox(w,h,d,.015,2),mat,pos,rot);
    const line=(pts,mat,r=.016)=>mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)),false,'centripetal',.1),100,r,6,false),mat);
    K.env(S,{top:'#ffffff',horizon:'#e6eaef',bottom:'#b8b4ad',intensity:.36});
    K.sun(S,{pos:[-14,20,18],target:[0,1,0],color:'#fff7ec',power:2.4,size:15,soft:1.3,mapSize:2048});
    K.skyLight(S,{color:'#e6eeff',power:1.35,size:15,center:[0,1,-1],mapSize:1024});
    mesh(new THREE.PlaneGeometry(500,500),white('#a9adb3'),[0,-.25,0],[-Math.PI/2,0,0]).castShadow=false;
    box(15,.22,11,M.foam,[0,-.13,0]);
    const score=K.canvasTex(1500,1100,(ctx,w,h)=>{ctx.fillStyle='#faf9f4';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#dfe1da';ctx.lineWidth=1;for(let x=50;x<w;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=50;y<h;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}ctx.strokeStyle='#a3aaa3';ctx.lineWidth=2;ctx.strokeRect(120,100,1200,880);ctx.setLineDash([6,8]);ctx.strokeRect(190,170,1060,740);ctx.setLineDash([]);ctx.fillStyle='#c6cbc2';ctx.font='18px monospace';ctx.fillText('N ↑',1360,125);});
    mesh(new THREE.PlaneGeometry(15,11),new THREE.MeshStandardMaterial({map:score,roughness:.94}),[0,-.012,0],[-Math.PI/2,0,0]).castShadow=false;
    // DE 105 bounding envelope at 0.4 scale, with plan-derived front openings.
    const w=5.24,d=3.992,h=1.32,pitch=38*Math.PI/180,hd=d/2,rise=hd*Math.tan(pitch);
    box(w+.18,.12,d+.18,M.foam,[.5,.06,0]);
    const front=new THREE.Shape([new THREE.Vector2(-w/2,0),new THREE.Vector2(w/2,0),new THREE.Vector2(w/2,h),new THREE.Vector2(-w/2,h)]);
    const opening=(center,width,height,sill)=>{const x=-w/2+center*.4,ww=width*.4,hh=height*.4;front.holes.push(new THREE.Path([[x-ww/2,sill],[x-ww/2,sill+hh],[x+ww/2,sill+hh],[x+ww/2,sill]].map(p=>new THREE.Vector2(...p))));box(ww,.035,.1,M.paper,[x+.5,sill-.005,hd+.045]);box(ww,hh,.025,M.glass,[x+.5,sill+hh/2,hd-.05]);box(.025,hh,.04,M.paper,[x+.5,sill+hh/2,hd+.01]);};
    opening(1.85,1.45,1.45,.34);opening(5.38,.9,2.3,0);opening(10.64,1.8,2.3,0);
    mesh(new THREE.ExtrudeGeometry(front,{depth:.08,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:1}),M.plaster,[.5,.12,hd]);
    box(w,h,.1,M.plaster,[.5,h/2+.12,-hd]);
    for(const side of [-1,1]){
      box(.12,h,d,M.plaster,[.5+side*w/2,h/2+.12,0]);
      const tri=new THREE.Shape([new THREE.Vector2(-hd,0),new THREE.Vector2(hd,0),new THREE.Vector2(0,rise)]);
      mesh(new THREE.ShapeGeometry(tri),new THREE.MeshStandardMaterial({color:'#eeebe6',side:THREE.DoubleSide,roughness:1}),[.5+side*w/2,h+.12,0],[0,Math.PI/2,0]);
      box(w+.24,.07,(hd+.16)/Math.cos(pitch),M.paper,[.5,h+.12+rise-(hd+.16)/2*Math.tan(pitch),side*(hd+.16)/2],[side*pitch,0,0]);
      box(w+.15,.18,.12,M.card,[.5,h+.06,side*hd]);
    }
    // Parking annex: plan-sized carport, not a second house or an unverified garage plan.
    const cx=-2.9,cz=-.02;
    box(1.56,.08,2.4,M.foam,[cx,.035,cz]);box(1.7,.1,2.55,M.card,[cx,1.08,cz]);
    for(const x of [cx-.67,cx+.67])for(const z of [cz-1.05,cz+1.05])box(.07,1.06,.07,M.plaster,[x,.55,z]);
    box(1.4,.035,2.6,M.paper,[cx,.012,2.5]);box(.65,.035,1.9,M.paper,[-.1,.015,3.1]);
    // Paper topography and model trees.
    for(const [x,z,r]of [[4.7,-3.3,.42],[5.8,-2.5,.5],[-5,3,.4],[-4.8,-3.1,.55]]){
      mesh(new THREE.CylinderGeometry(.03,.04,.8,12),M.plaster,[x,.4,z]);mesh(new THREE.SphereGeometry(r,24,16),M.card,[x,.8+r*.7,z]);
      mesh(new THREE.CylinderGeometry(r*1.3,r*1.35,.035,40),M.foam,[x,.02,z]);
    }
    for(let i=0;i<4;i++)mesh(new THREE.CylinderGeometry(1.25-i*.2,1.25-i*.2,.06,64),M.card,[4.7,.03+i*.06,3.3]);
    const pv=[];for(let c=0;c<5;c++)for(let r=0;r<2;r++){const m=white('#eef3f8');const z=.5+r*.55;box(.43,.035,.48,m,[.5+c*.48,h+.12+rise-z*Math.tan(pitch)+.075,z],[pitch,0,0]);pv.push(m);}
    // Fireplace chimney; the recuperation terminals remain distinct from it.
    box(.22,.78,.25,M.plaster,[-.65,2.55,-.45]);box(.3,.05,.32,M.paper,[-.65,2.96,-.45]);
    for(const x of [1.1,1.55]){mesh(new THREE.CylinderGeometry(.055,.055,.3,16),M.foam,[x,2.6,-.6]);box(.17,.025,.17,M.paper,[x,2.76,-.6]);}
    const pump=white('#eef3f8');box(.72,.62,.3,pump,[3.58,.4,.7]);
    const fan=mesh(new THREE.TorusGeometry(.21,.025,8,32),M.plaster,[3.58,.4,.865]);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;box(.025,.34,.018,M.foam,[3.58,.4,.88],[0,0,a]);}fan.name='heat-pump';
    const accent=new THREE.Color('#ff6a00'),runs=[];
    const route=(pts,start,end)=>{
      const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)),false,'centripetal',.1);
      line(pts,M.foam,.022);
      const material=new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:.4,roughness:.55});
      const geo=new THREE.TubeGeometry(curve,160,.026,8,false),m=mesh(geo,material);runs.push({m,curve,start,end});
    };
    route([[-6,.04,4.2],[-6,.04,-4.2],[6,.04,-4.2],[6,.04,4.2],[-6,.04,4.2]],0,2.3);
    route([[-6,.05,4.2],[-2.2,.05,2.2],[3.2,.05,2.2],[3.2,.05,-2.2],[-2.2,.05,-2.2],[-2.2,.05,2.2]],2.4,4.6);
    route([[-2.2,.07,2.2],[-3.8,.07,1.3],[-3.8,.07,-1.3],[-2,.07,-1.3],[-2,.07,1.3],[-3.8,.07,1.3]],4.8,7.1);
    route([[3.2,.07,2.2],[3.6,.07,.9],[3.6,.5,.9],[3,.7,1.1],[2.95,2.2,.5],[1.8,2.65,.5]],7.4,9.8);
    const bead=mesh(new THREE.SphereGeometry(.065,20,12),new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:2}));
    const glow=new THREE.PointLight(accent,1.4,2);scene.add(glow);
    const labels=[[-5.7,.06,3.7],[.5,.2,2.1],[-3,1.2,0],[2.5,2.6,.6]];
    return {
      update(t){
        const u=K.smooth(0,10,t);camera.position.set(K.lerp(10,14,u),K.lerp(7,12,u),K.lerp(17,21,u));camera.lookAt(0,.4,0);camera.userData.aperture=.025;camera.userData.focus=camera.position.distanceTo(new THREE.Vector3(0,1,0));
        let active=runs[0];for(const r of runs){const p=K.clamp((t-r.start)/(r.end-r.start));r.m.geometry.setDrawRange(0,Math.floor(p*160)*8*6);r.m.visible=p>0;if(t>=r.start)active=r;}
        const p=K.clamp((t-active.start)/(active.end-active.start));bead.position.copy(active.curve.getPointAt(p));glow.position.copy(bead.position);bead.visible=t<10;
        for(let i=0;i<pv.length;i++){const k=K.smooth(8.5+i*.07,9.3+i*.07,t);pv[i].color.copy(new THREE.Color('#eef3f8')).lerp(accent,k*.85);pv[i].emissive.copy(accent);pv[i].emissiveIntensity=k*.22;}pump.color.copy(new THREE.Color('#eef3f8')).lerp(accent,K.smooth(7.7,8.4,t)*.65);
      },
      overlay(ctx,t,W,H){
        const i=t<2.4?0:t<4.8?1:t<7.4?2:3;
        const p=new THREE.Vector3(...labels[i]).project(camera),x=(p.x*.5+.5)*W,y=(-p.y*.5+.5)*H;
        const lx=i===0?W*.12:i===1?W*.67:i===2?W*.12:W*.67,ly=i===2?H*.22:H*.18;
        ctx.strokeStyle='#3d4842';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(lx+15,ly+22);ctx.lineTo(lx+230,ly+22);ctx.stroke();ctx.fillStyle='#3d4842';ctx.beginPath();ctx.arc(x,y,4,0,7);ctx.fill();
        ctx.font='600 22px "IBM Plex Mono"';ctx.fillText(beats[i].caption,lx,ly);ctx.font='400 19px "Inter"';ctx.fillStyle='#59665f';ctx.fillText(i===0?'Granica wybranej działki':i===1?'DE 105 · obrys z planu':i===2?'Dodatkowy obrys na działce':'Panele · pompa ciepła',lx,ly+50);
      }
    };
  }
};
const stage=await K.run(document.querySelector('#stage'),style,{samples:16,width:1920,height:1080});
console.info('Storyboard: scene built');
for(const beat of beats){
  stage.seek(beat.time);
  console.info('Storyboard: rendered',beat.time);
  const article=document.createElement('article');const img=new Image();img.src=stage.renderer.domElement.toDataURL('image/png');img.alt=beat.title+' — biała makieta domu na planszy z pomarańczowym akcentem';article.append(img);
  const copy=document.createElement('div');copy.className='copy';copy.innerHTML=`<div class="eyebrow">${beat.range}</div><h2>${beat.title}</h2><dl><dt>Tekst</dt><dd>${beat.caption}</dd><dt>Zmiana</dt><dd>${beat.move}</dd><dt>Kamera</dt><dd>${beat.camera}</dd><dt>Dźwięk</dt><dd>${beat.sound}</dd></dl>`;article.append(copy);document.querySelector('#panels').append(article);
  await new Promise(resolve=>requestAnimationFrame(resolve));
}
document.querySelector('#status').textContent='4 klatki gotowe · 1920 × 1080 · 16 próbek / klatkę · nieruchomy storyboard';
window.storyboardReady=true;
