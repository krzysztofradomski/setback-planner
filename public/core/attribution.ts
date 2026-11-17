// First-party campaign attribution (UTM and campaign labels) for inquiries. Bounded labels only; no personal data.
import { parseScene, type Scene } from './scene.ts';

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
