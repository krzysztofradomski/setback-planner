import QRCode from 'qrcode';
import type { Scene } from './core/scene.ts';
import { ATTRIBUTION_KEY, campaignLabel, clearKioskStorage, exampleScene, inactivitySettings, publicProjectUrl, readAttribution, validateAttribution, type Attribution } from './core/showroom.ts';
import './showroom.css';

export interface ShowroomOptions {
  container:HTMLElement;
  getScene:()=>Scene;
  applyScene:(scene:Scene)=>void;
  shareUrl:()=>string|Promise<string>;
  setView?:(view:'2d'|'3d'|'map')=>void;
  /** Host must suspend ordinary autosave while active and restore ordinary undo history on exit. */
  onActiveChange?:(active:boolean)=>void;
  /** Clear host inquiry forms, temporary exports, selection and visitor undo history here. */
  onSessionReset?:()=>void;
  idleSeconds?:number;
  warningSeconds?:number;
}
export function mountShowroom(options:ShowroomOptions){
  const {container}=options,settings=inactivitySettings(options.idleSeconds,options.warningSeconds);
  let attribution:Attribution|null=null;
  try{attribution=validateAttribution(JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY)??'null'));}catch{/* Storage can be unavailable in privacy mode. */}
  attribution=readAttribution(location.search,attribution);
  const persistAttribution=()=>{try{if(attribution)sessionStorage.setItem(ATTRIBUTION_KEY,JSON.stringify(attribution));else sessionStorage.removeItem(ATTRIBUTION_KEY);}catch{/* In-memory attribution still works. */}};
  persistAttribution();
  let active=false,initialScene:Scene|null=null,lastActivity=Date.now(),warningShown=false,step=0,qrGeneration=0;
  const panel=document.createElement('section');panel.className='showroom';panel.setAttribute('aria-label','Showroom presentation');
  panel.innerHTML=`<details class="showroom-setup"><summary>Showroom / Tryb pokazowy</summary>
    <p>Presentation mode uses separate visitor sessions. Your current project is restored when you leave.</p>
    <label>Profile name <input name="profile" maxlength="80" placeholder="Setback Planner"></label>
    <label>Manufacturer label <input name="manufacturer" maxlength="80" autocomplete="off"></label>
    <label>Event label <input name="event" maxlength="80" autocomplete="off"></label>
    <label>Campaign label <input name="campaign" maxlength="80" autocomplete="off"></label>
    <p>Optional public campaign labels only. Do not enter names, email addresses or contact details.</p>
    <button type="button" data-action="enter">Start presentation / Rozpocznij pokaz</button></details>
    <div class="showroom-controls" hidden><strong data-role="brand">Setback Planner</strong>
      <button type="button" data-action="2d">Plan 2D</button><button type="button" data-action="3d">Explore 3D</button>
      <button type="button" data-action="compact">Example home</button><button type="button" data-action="garden">Example garden</button>
      <button type="button" data-action="guide">Guided demo</button><button type="button" data-action="share">Take project to phone</button>
      <button type="button" data-action="reset">New visitor / Reset</button><button type="button" data-action="fullscreen">Fullscreen</button>
      <button type="button" data-action="exit">Exit presentation</button>
      <p data-role="step" aria-live="polite"></p><p data-role="status" role="status"></p>
    </div>
    <dialog class="showroom-attract" aria-label="Welcome to the showroom" hidden><div><p data-role="welcome">Setback Planner</p><h2>Imagine your place.</h2>
      <p>Explore an example home and garden, then take your project to your phone.</p><button type="button" data-action="begin">Touch to begin / Dotknij, aby rozpocząć</button></div></dialog>`;
  container.append(panel);
  const find=<T extends HTMLElement>(selector:string)=>panel.querySelector<T>(selector)!;
  const setup=find<HTMLDetailsElement>('.showroom-setup'),controls=find('.showroom-controls'),attract=find<HTMLDialogElement>('.showroom-attract'),status=find('[data-role="status"]');
  const warning=document.createElement('dialog');warning.className='showroom-dialog';warning.setAttribute('aria-labelledby','showroom-warning-title');
  warning.innerHTML='<h2 id="showroom-warning-title">Still planning?</h2><p data-role="countdown" aria-live="polite"></p><button type="button" data-action="continue">Keep planning / Kontynuuj</button><button type="button" data-action="reset">Finish and reset</button>';
  const transfer=document.createElement('dialog');transfer.className='showroom-dialog';transfer.setAttribute('aria-labelledby','showroom-transfer-title');
  transfer.innerHTML='<h2 id="showroom-transfer-title">Take your project with you</h2><p>Scan with your phone camera. The link contains this project; it does not contain contact details or campaign labels.</p><canvas aria-label="QR code for this project" role="img"></canvas><a target="_blank" rel="noopener noreferrer">Open project link</a><p data-role="qr-status" role="status"></p><button type="button" data-action="close-share">Close</button>';
  container.append(warning,transfer);
  const closeTransfer=()=>{qrGeneration++;transfer.close();transfer.querySelector('a')!.removeAttribute('href');const canvas=transfer.querySelector('canvas')!;canvas.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);};
  const activity=()=>{if(!active||warningShown)return;lastActivity=Date.now();};
  const recover=(error:unknown)=>{status.textContent=error instanceof Error?error.message:'Unable to complete presentation action. Start a new visitor session to recover.';};
  const clearVisitor=()=>{
    for(const storageName of ['localStorage','sessionStorage'] as const){try{clearKioskStorage(window[storageName]);}catch{/* Session reset still clears in-memory state. */}}
    options.onSessionReset?.();
  };
  const reset=()=>{
    closeTransfer();warning.close();warningShown=false;clearVisitor();
    options.applyScene(exampleScene());step=0;find('[data-role="step"]').textContent='';status.textContent='';lastActivity=Date.now();
    attract.hidden=false;if(!attract.open)attract.showModal();controls.hidden=true;find<HTMLButtonElement>('[data-action="begin"]').focus();
  };
  const enter=()=>{
    if(active)return;
    const labels=new URLSearchParams();
    for(const key of ['manufacturer','event','campaign']){const input=find<HTMLInputElement>(`[name="${key}"]`);if(input.value&&!campaignLabel(input.value)){input.setCustomValidity('Use a public label up to 80 letters, numbers, spaces, dots, underscores or hyphens.');input.reportValidity();return;}input.setCustomValidity('');if(input.value)labels.set(key,input.value);}
    attribution=readAttribution(labels.toString(),attribution);persistAttribution();
    const brand=campaignLabel(find<HTMLInputElement>('[name="profile"]').value)||'Setback Planner';find('[data-role="brand"]').textContent=brand;find('[data-role="welcome"]').textContent=brand;
    initialScene=structuredClone(options.getScene());active=true;options.onActiveChange?.(true);setup.hidden=true;panel.classList.add('is-active');reset();
  };
  const exit=()=>{
    if(!active)return;
    closeTransfer();warning.close();warningShown=false;
    clearVisitor();
    if(initialScene)options.applyScene(initialScene);
    initialScene=null;active=false;options.onActiveChange?.(false);setup.hidden=false;controls.hidden=true;attract.close();attract.hidden=true;panel.classList.remove('is-active');
    if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});
  };
  const act=async(action:string)=>{
    if(action==='enter'){enter();return;}
    if(!active)return;
    if(action==='continue'){warning.close();warningShown=false;lastActivity=Date.now();return;}
    if(action==='reset'){reset();return;}
    if(action==='exit'){exit();return;}
    if(action==='begin'){attract.close();attract.hidden=true;controls.hidden=false;lastActivity=Date.now();find<HTMLButtonElement>('[data-action="2d"]').focus();return;}
    if(action==='close-share'){closeTransfer();return;}
    if(action==='fullscreen'){if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();return;}
    if(action==='2d'||action==='3d'){options.setView?.(action);return;}
    if(action==='compact'||action==='garden'){options.applyScene(exampleScene(action));find('[data-role="step"]').textContent='Editable example dimensions, not a manufacturer specification.';return;}
    if(action==='guide'){
      const steps=[{text:'1 / 3 — Start with a parcel and an editable example house.',scene:exampleScene(),view:'2d' as const},{text:'2 / 3 — Add outdoor spaces and compare the layout.',scene:exampleScene('garden'),view:'2d' as const},{text:'3 / 3 — Explore in 3D, then use Take project to phone.',scene:exampleScene('garden'),view:'3d' as const}];
      const next=steps[step++%steps.length];options.applyScene(next.scene);options.setView?.(next.view);find('[data-role="step"]').textContent=next.text;return;
    }
    if(action==='share'){
      const generation=++qrGeneration;transfer.showModal();const qrStatus=transfer.querySelector<HTMLElement>('[data-role="qr-status"]')!;qrStatus.textContent='Preparing project…';
      try{
        const link=publicProjectUrl(await options.shareUrl(),location.href);if(generation!==qrGeneration)return;
        const canvas=document.createElement('canvas');
        await QRCode.toCanvas(canvas,link,{width:280,margin:3,errorCorrectionLevel:'L'});if(generation!==qrGeneration)return;
        canvas.setAttribute('aria-label','QR code for this project');canvas.setAttribute('role','img');transfer.querySelector('canvas')!.replaceWith(canvas);
        transfer.querySelector('a')!.href=link;qrStatus.textContent='Scan to continue planning on your phone.';
      }catch{if(generation===qrGeneration)qrStatus.textContent='This project is too large for a QR code or the link is unavailable. Export the project using the planner.';}
    }
  };
  const clicked=(event:Event)=>{const target=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');if(target)void act(target.dataset.action!).catch(recover);};
  panel.addEventListener('click',clicked);warning.addEventListener('click',clicked);transfer.addEventListener('click',clicked);
  attract.addEventListener('cancel',event=>{event.preventDefault();void act('begin');});
  warning.addEventListener('cancel',event=>{event.preventDefault();void act('continue');});
  transfer.addEventListener('close',()=>{lastActivity=Date.now();});
  const events=['pointerdown','keydown','wheel','input'] as const;
  for(const event of events)document.addEventListener(event,activity,{passive:true});
  const timer=window.setInterval(()=>{
    if(!active||!attract.hidden)return;
    const remaining=Math.ceil(settings.idleSeconds-(Date.now()-lastActivity)/1000);
    if(remaining<=0){try{reset();}catch(error){recover(error);}return;}
    if(remaining<=settings.warningSeconds){
      if(!warningShown){closeTransfer();warningShown=true;warning.showModal();}
      warning.querySelector('[data-role="countdown"]')!.textContent=`This visitor session resets in ${remaining} seconds. Keep planning to extend the session.`;
    }
  },1000);
  return {enter,exit,reset:()=>{if(active)reset();},isActive:()=>active,getAttribution:()=>attribution?structuredClone(attribution):null,destroy:()=>{exit();window.clearInterval(timer);for(const event of events)document.removeEventListener(event,activity);panel.remove();warning.remove();transfer.remove();}};
}
