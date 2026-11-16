import { parseScene, type Scene } from './scene.ts';

export const KIOSK_PREFIX='setback-planner:kiosk:';
export const ATTRIBUTION_KEY='setback-planner:attribution:v1';
export const attributionFields=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','manufacturer','showroom','event','campaign','representative'] as const;
export type AttributionField=typeof attributionFields[number];
export type Attribution=Partial<Record<AttributionField,string>>&{firstSeenAt:string;lastSeenAt:string};
/** Only campaign labels are retained, never the URL, referrer, contact data or device identifiers. */
export function campaignLabel(value:unknown):string|undefined {
  if(typeof value!=='string')return undefined;
  const clean=value.trim();
  return clean.length>0&&clean.length<=80&&/^[\p{L}\p{N} _.-]+$/u.test(clean)?clean:undefined;
}
export function readAttribution(search:string,previous:Attribution|null=null,now=new Date()):Attribution|null {
  const values:Partial<Record<AttributionField,string>>={};
  const params=new URLSearchParams(search);
  for(const key of attributionFields){const value=campaignLabel(params.get(key));if(value)values[key]=value;}
  if(!Object.keys(values).length)return previous?validateAttribution(previous):null;
  const timestamp=now.toISOString(),valid=previous?validateAttribution(previous):null;
  return {...(valid??{}),...values,firstSeenAt:valid?.firstSeenAt??timestamp,lastSeenAt:timestamp};
}
export function validateAttribution(input:unknown):Attribution|null {
  if(!input||typeof input!=='object')return null;
  const raw=input as Record<string,unknown>;
  if(typeof raw.firstSeenAt!=='string'||typeof raw.lastSeenAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(raw.firstSeenAt)||!/^\d{4}-\d{2}-\d{2}T/.test(raw.lastSeenAt)||!Number.isFinite(Date.parse(raw.firstSeenAt))||!Number.isFinite(Date.parse(raw.lastSeenAt)))return null;
  const values:Partial<Record<AttributionField,string>>={};
  for(const key of attributionFields){const value=campaignLabel(raw[key]);if(value)values[key]=value;}
  return Object.keys(values).length?{...values,firstSeenAt:new Date(raw.firstSeenAt).toISOString(),lastSeenAt:new Date(raw.lastSeenAt).toISOString()}:null;
}
export function inactivitySettings(idleSeconds=180,warningSeconds=20){
  const idle=Number.isFinite(idleSeconds)?Math.min(1800,Math.max(30,Math.round(idleSeconds))):180;
  const warning=Number.isFinite(warningSeconds)?Math.min(60,Math.max(10,Math.round(warningSeconds))):20;
  return {idleSeconds:idle,warningSeconds:Math.min(warning,idle-10)};
}
export interface KeyStorage {length:number;key(index:number):string|null;removeItem(key:string):void}
export function clearKioskStorage(storage:KeyStorage){
  const keys:string[]=[];
  for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(KIOSK_PREFIX))keys.push(key);}
  for(const key of keys)storage.removeItem(key);
}
export function exampleScene(kind:'compact'|'garden'='compact'):Scene {
  return parseScene({plot:[{x:0,y:0},{x:32,y:0},{x:32,y:40},{x:0,y:40}],items:[
    {id:'demo-house',type:'house',name:'Example home',x:10,y:12,w:10,d:12,setback:4},
    ...(kind==='garden'?[
      {id:'demo-terrace',type:'landscape',kind:'terrace',name:'Terrace',x:12,y:24,w:6,d:4,setback:0},
      {id:'demo-tree',type:'landscape',kind:'tree',name:'Garden tree',x:25,y:30,w:4,d:4,setback:0},
    ]:[]),
  ]});
}
/** Remove query parameters entirely: project links carry scene state, not visitor or campaign data. */
export function publicProjectUrl(value:string,base:string):string {
  const url=new URL(value,base),origin=new URL(base).origin;
  if(url.origin!==origin||!/^#(?:p|s|z)=[\w-]+$/.test(url.hash))throw new Error('A complete project link is unavailable.');
  url.search='';url.username='';url.password='';
  return url.toString();
}
