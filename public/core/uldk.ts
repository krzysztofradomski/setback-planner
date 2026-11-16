import { parse } from 'wellknown';
import { importParcel } from './geospatial.ts';
import { MAX_PROJECT_BYTES } from './scene.ts';
const identifierPattern=/^\d{6}_[1-9]\.[\w.-]+\.\d+(?:\/\d+)?$/;
export function parseUldkResponse(text:string,identifier:string,retrievedAt:string){
  if(text.length>MAX_PROJECT_BYTES)throw new Error('Parcel response too large');
  const lines=text.trim().split(/\r?\n/);
  if(lines.length!==2||lines[0].trim()!=='0')throw new Error('ULDK did not return one parcel');
  let wkt=lines[1].trim();
  const srid=wkt.match(/^SRID=(\d+);/i);
  if(srid&&srid[1]!=='2180')throw new Error('Unexpected parcel CRS');
  if(srid)wkt=wkt.slice(srid[0].length);
  const geometry=parse(wkt);
  const result=importParcel(geometry,'EPSG:2180','GUGiK ULDK',retrievedAt);
  return {...result,parcel:{...result.parcel,identifier,source:{...result.parcel.source,url:'https://uldk.gugik.gov.pl/'}}};
}
async function fetchUldk(params:Record<string,string>,fetcher:typeof fetch){
  const url=new URL('https://uldk.gugik.gov.pl/');url.search=new URLSearchParams(params).toString();
  const response=await fetcher(url,{signal:AbortSignal.timeout(10000),credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
  if(!response.ok||!response.body)throw new Error('Parcel service unavailable');
  const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
  try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_PROJECT_BYTES)throw new Error('Parcel response too large');text+=decoder.decode(value,{stream:true});}
    text+=decoder.decode();
  }finally{await reader.cancel();}
  return text;
}
export async function lookupParcel(identifier:string,fetcher:typeof fetch=fetch){
  if(identifier.length>80||!identifierPattern.test(identifier))throw new Error('Enter a full Polish parcel identifier');
  const text=await fetchUldk({request:'GetParcelById',id:identifier,result:'geom_wkt',srid:'2180'},fetcher);
  return parseUldkResponse(text,identifier,new Date().toISOString());
}
export async function lookupParcelAt(longitude:number,latitude:number,fetcher:typeof fetch=fetch){
  if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||longitude<13||longitude>25||latitude<48||latitude>56)throw new Error('Coordinates outside supported Polish region');
  const text=await fetchUldk({request:'GetParcelByXY',xy:`${longitude},${latitude},4326`,result:'id,geom_wkt',srid:'2180'},fetcher);
  const lines=text.trim().split(/\r?\n/),fields=lines[1]?.split('|');
  if(lines.length!==2||lines[0].trim()!=='0'||fields?.length!==2||!identifierPattern.test(fields[0]))throw new Error('Invalid map parcel response');
  return parseUldkResponse(`0\n${fields[1]}`,fields[0],new Date().toISOString());
}
