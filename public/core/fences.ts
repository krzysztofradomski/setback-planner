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

export const BOUNDARY_FENCE_ID='boundary';
type P={x:number;y:number};
/** Edge whose midpoint lies furthest in front of the house (rot 0 faces +y); without a house, the edge nearest the plan's bottom. */
export function facingEdge(plot:P[],house?:{x:number;y:number;rot:number}){
 const r=(house?.rot??0)*Math.PI/180,front={x:-Math.sin(r),y:Math.cos(r)},o=house??{x:0,y:0};
 const score=plot.map((a,i)=>{const b=plot[(i+1)%plot.length];return((a.x+b.x)/2-o.x)*front.x+((a.y+b.y)/2-o.y)*front.y;});
 return score.indexOf(Math.max(...score));
}
/** Metal panel fence along every property line, with a 4 m sliding gate centred on `gateEdge` when that edge is long enough. Null when the parcel cannot carry one. */
export function boundaryFence(plot:P[],gateEdge:number,name:string):Fence|null{
 if(plot.length<3||plot.length>63)return null;
 const a=plot[gateEdge],b=plot[(gateEdge+1)%plot.length],len=a&&b?Math.hypot(b.x-a.x,b.y-a.y):0,width=Math.min(4,len-1);
 const r=fenceSchema.safeParse({id:BOUNDARY_FENCE_ID,name,type:'metal-panel',path:[...plot,plot[0]].map(p=>({x:p.x,y:p.y})),height:1.5,width:.08,spacing:2.5,color:'#3a3d41',foundation:.3,maturity:1,
  gate:width>=2.5?{edge:gateEdge,offset:(len-width)/2,width,type:'sliding',open:false,inward:true}:null});
 return r.success?r.data:null;
}
