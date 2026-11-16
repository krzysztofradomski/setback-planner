import { geographicPoint } from './geospatial.ts';

export const LOCATION_PROVIDER={name:'GUGiK UUG',url:'https://services.gugik.gov.pl/uug/',documentationUrl:'https://services.gugik.gov.pl/uug/opis.html'} as const;
export type LocationCandidate={label:string;longitude:number;latitude:number;provider:typeof LOCATION_PROVIDER.name;kind:'address'|'street'|'locality'};
const MAX_RESPONSE_BYTES=65536;
const MAX_RESULTS=15;
const invalid=()=>new Error('Invalid address service response');
const hasControl=(value:string)=>Array.from(value).some(character=>character.charCodeAt(0)<32);
function record(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();
  return value as Record<string,unknown>;
}
function text(value:unknown,required=false):string{
  if(value===undefined||value===null){if(required)throw invalid();return '';}
  if(typeof value!=='string'||value.length>300||(/[<>]/u.test(value)||hasControl(value))||required&&!value.trim())throw invalid();
  return value.trim();
}
function coordinate(value:unknown):number{
  if(typeof value!=='string'||!/^\d{1,7}(?:\.\d+)?$/.test(value))throw invalid();
  const result=Number(value);
  if(!Number.isFinite(result)||result<10000||result>1000000)throw invalid();
  return result;
}
function parseLocations(body:string):LocationCandidate[]{
  let data:Record<string,unknown>;
  try{data=record(JSON.parse(body));}catch{throw invalid();}
  const kind=data.type==='city'?'locality':data.type==='street'?'street':data.type==='address'?'address':null;
  if(!kind||!Number.isSafeInteger(data['found objects'])||Number(data['found objects'])<0)throw invalid();
  if(data.results===null&&data['found objects']===0)return [];
  const entries=Object.entries(record(data.results));
  if(entries.length>MAX_RESULTS||entries.length>Number(data['found objects']))throw invalid();
  return entries.map(([key,value])=>{
    if(!/^[1-9]\d*$/.test(key))throw invalid();
    const item=record(value),city=text(item.city,true),street=text(item.street),number=text(item.number);
    if(kind==='street'&&!street||kind==='address'&&!number)throw invalid();
    // UUG x/y are PL-1992 easting/northing, not the axis labels in EPSG's formal definition.
    const [longitude,latitude]=geographicPoint([coordinate(item.x),coordinate(item.y)]);
    if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||longitude<13||longitude>25||latitude<48||latitude>56)throw invalid();
    const administrative=[text(item.voivodeship),text(item.county),text(item.commune)].filter(Boolean);
    const area=administrative.length?administrative.join(', '):text(item.jednostka).replace(/^[{(]|[})]$/g,'').split(',').filter(part=>part!=='Polska'&&part!==city).join(', ');
    const label=[city,`${street} ${number}`.trim()].filter(Boolean).join(', ')+(area?` (${area})`:'');
    return {label,longitude,latitude,provider:LOCATION_PROVIDER.name,kind};
  });
}

/** Explicit, single-submit map search. A candidate is never a confirmed parcel. */
export async function searchLocations(query:string,fetcher:typeof fetch=fetch,signal?:AbortSignal):Promise<LocationCandidate[]>{
  if(typeof query!=='string'||query.length>200||hasControl(query)||query.trim().length<3)throw new Error('Enter a Polish address or locality (3–200 characters)');
  signal?.throwIfAborted();
  const requestSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000);
  const url=new URL(LOCATION_PROVIDER.url);
  url.search=new URLSearchParams({request:'GetAddress',address:query.trim(),exact_number:'1'}).toString();
  const response=await fetcher(url,{signal:requestSignal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
  if(!response.ok||!response.body)throw new Error('Address service unavailable; try again or locate the parcel on the map');
  const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,body='';
  try{
    while(true){
      requestSignal.throwIfAborted();
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>MAX_RESPONSE_BYTES)throw new Error('Address service response too large');
      body+=decoder.decode(value,{stream:true});
    }
    body+=decoder.decode();
  }finally{await reader.cancel();}
  return parseLocations(body);
}
