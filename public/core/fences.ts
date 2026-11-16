import {z} from 'zod';
const point=z.object({x:z.number().finite().min(-1e5).max(1e5),y:z.number().finite().min(-1e5).max(1e5)});
export const fenceSchema=z.object({id:z.string().regex(/^[\w-]+$/),name:z.string().max(60),type:z.enum(['metal-panel','palisade-horizontal','palisade-vertical','wood','gabion','masonry','mixed','hedge-evergreen','hedge-deciduous']),path:z.array(point).min(2).max(64),height:z.number().min(.2).max(5),width:z.number().min(.05).max(3),spacing:z.number().min(.5).max(10),color:z.string().regex(/^#[0-9a-f]{6}$/i),foundation:z.number().min(0).max(1),maturity:z.number().min(0).max(1),gate:z.object({edge:z.number().int().min(0),offset:z.number().min(0),width:z.number().min(.5).max(10),type:z.enum(['sliding','swing','wicket']),open:z.boolean(),inward:z.boolean()}).nullable()}).strict().superRefine((f,ctx)=>{
 let length=0;for(let i=1;i<f.path.length;i++){const d=Math.hypot(f.path[i].x-f.path[i-1].x,f.path[i].y-f.path[i-1].y);if(d<.01)ctx.addIssue({code:'custom',message:'Zero-length fence edge'});length+=d;}
 if(length>500)ctx.addIssue({code:'custom',message:'Fence length exceeds 500 m'});
 if(f.gate){const a=f.path[f.gate.edge],b=f.path[f.gate.edge+1];if(!a||!b||f.gate.offset+f.gate.width>Math.hypot(a.x-b.x,a.y-b.y))ctx.addIssue({code:'custom',message:'Gate must fit its fence edge'});}
});
export type Fence=z.infer<typeof fenceSchema>;
export function fenceSegments(f:Fence){
 const result:{a:{x:number;y:number};b:{x:number;y:number};gate:boolean}[]=[];
 for(let edge=0;edge<f.path.length-1;edge++){
 const a=f.path[edge],b=f.path[edge+1],length=Math.hypot(b.x-a.x,b.y-a.y),gate=f.gate?.edge===edge?f.gate:null;
 const cuts=[0,length];if(gate)cuts.push(gate.offset,gate.offset+gate.width);cuts.sort((a,b)=>a-b);
 for(let i=1;i<cuts.length;i++){const from=cuts[i-1],to=cuts[i];if(to-from<.001)continue;const isGate=!!gate&&from>=gate.offset&&to<=gate.offset+gate.width,n=isGate?1:Math.ceil((to-from)/f.spacing);
 for(let j=0;j<n;j++){const p=from+(to-from)*j/n,q=from+(to-from)*(j+1)/n;result.push({a:{x:a.x+(b.x-a.x)*p/length,y:a.y+(b.y-a.y)*p/length},b:{x:a.x+(b.x-a.x)*q/length,y:a.y+(b.y-a.y)*q/length},gate:isGate});}}
 }return result;
}
