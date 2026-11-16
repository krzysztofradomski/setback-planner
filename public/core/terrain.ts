import type{Scene}from'./scene.ts';
export interface TerrainSample{x:number;y:number;z:number}
export function terrainHeight(samples:TerrainSample[],x:number,y:number){let sum=0,weight=0;for(const p of samples){const distance=(x-p.x)**2+(y-p.y)**2;if(distance<1e-10)return p.z;const w=1/distance;sum+=p.z*w;weight+=w;}return weight?sum/weight:0;}
export async function sampleTerrain(scene:Scene,fetcher:typeof fetch=fetch){
 const origin=scene.coordinates.projected?.origin;if(!origin)throw new Error('Import a georeferenced parcel first');
 const xs=scene.plot.map(p=>p.x),ys=scene.plot.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),samples:TerrainSample[]=[];
 for(let row=0;row<3;row++)for(let col=0;col<3;col++)samples.push({x:minX+(maxX-minX)*col/2,y:minY+(maxY-minY)*row/2,z:0});
 const list=samples.map(p=>`${origin.y-p.y} ${origin.x+p.x}`).join(','),url=new URL('https://services.gugik.gov.pl/nmt/');url.search=new URLSearchParams({request:'GetHByPointList',list}).toString();
 const response=await fetcher(url,{signal:AbortSignal.timeout(15000),credentials:'omit',redirect:'error'});if(!response.ok||!response.body)throw new Error('NMT unavailable');
 const reader=response.body.getReader();let bytes=0,text='';const decoder=new TextDecoder();try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>32768)throw new Error('NMT response too large');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}
 const records=text.trim().split(',');if(records.length!==samples.length)throw new Error('Incomplete NMT response');
 records.forEach((record,i)=>{if(!/^\s*-?[\d.]+\s+-?[\d.]+\s+-?[\d.]+\s*$/.test(record))throw new Error('Invalid NMT record');const [north,east,z]=record.trim().split(/\s+/).map(Number),p=samples[i];if(!Number.isFinite(z)||z< -500||z>9000||Math.abs(north-(origin.y-p.y))>.01||Math.abs(east-(origin.x+p.x))>.01)throw new Error('Invalid elevation or axis order');p.z=z;});
 const dx=maxX-minX,dy=maxY-minY,slopePercent=Math.hypot(dx?(samples[5].z-samples[3].z)/dx:0,dy?(samples[7].z-samples[1].z)/dy:0)*100;
 return{samples,slopePercent,source:'GUGiK NMT',url:'https://services.gugik.gov.pl/nmt/',retrievedAt:new Date().toISOString(),verticalDatum:'unspecified' as const};
}
