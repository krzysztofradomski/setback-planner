/** Deterministic planar geometry in metres. No rendering or planning-law dependencies. */
export interface Point { x: number; y: number }
export const EPS = 1e-8;
export const edges = (p: Point[]) => p.map((a,i) => [a,p[(i+1)%p.length]] as const);
const cross = (a:Point,b:Point,c:Point) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const equal = (a:Point,b:Point) => Math.hypot(a.x-b.x,a.y-b.y)<EPS;
export function signedArea(p:Point[]) { return p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.y-b.x*a.y;},0)/2; }
export const polygonArea = (p:Point[]) => Math.abs(signedArea(p));
export function closestPoint(p:Point,a:Point,b:Point):Point {
  const dx=b.x-a.x,dy=b.y-a.y, l=dx*dx+dy*dy;
  const t=l ? Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;
  return {x:a.x+t*dx,y:a.y+t*dy};
}
function onSegment(p:Point,a:Point,b:Point) { return equal(p,closestPoint(p,a,b)); }
export function segmentRelation(a:Point,b:Point,c:Point,d:Point):'cross'|'touch'|'disjoint' {
  const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
  if (((abC>EPS && abD< -EPS)||(abC< -EPS && abD>EPS)) && ((cdA>EPS && cdB< -EPS)||(cdA< -EPS && cdB>EPS))) return 'cross';
  return onSegment(a,c,d)||onSegment(b,c,d)||onSegment(c,a,b)||onSegment(d,a,b)?'touch':'disjoint';
}
/** Boundary is reported separately, making touching behavior explicit. */
export function pointLocation(p:Point,ring:Point[]):'inside'|'boundary'|'outside' {
  let inside=false;
  for(const [a,b] of edges(ring)) {
    if(onSegment(p,a,b)) return 'boundary';
    if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside?'inside':'outside';
}
export function validRing(ring:Point[]):boolean {
  if(ring.length<3||ring.length>512||!ring.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1e7&&Math.abs(p.y)<=1e7)) return false;
  if(polygonArea(ring)<EPS) return false;
  for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length];
    if(equal(a,b)) return false;
    for(let j=i+1;j<ring.length;j++) {
      if(j===i+1 || (i===0 && j===ring.length-1)) continue;
      if(segmentRelation(a,b,ring[j],ring[(j+1)%ring.length])!=='disjoint') return false;
    }
    // Reject an adjacent edge folding back onto itself.
    const c=ring[(i+2)%ring.length];
    if(onSegment(c,a,b)||onSegment(a,b,c)) return false;
  }
  return true;
}
export function transformFootprint(points:Point[], transform:{x:number;y:number;rot:number}):Point[] {
  const r=transform.rot*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  return points.map(p=>({x:transform.x+p.x*c-p.y*s,y:transform.y+p.x*s+p.y*c}));
}
// Split an edge at all target intersections; midpoint classification then catches
// concave excursions and coincident edge intervals, without convex-only assumptions.
function edgeSamples(a:Point,b:Point,ring:Point[]) {
  const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,ts=[0,1];
  for(const [c,d] of edges(ring)) {
    const ex=d.x-c.x,ey=d.y-c.y,den=dx*ey-dy*ex;
    if(Math.abs(den)>EPS) {
      const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/den,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/den;
      if(t>0&&t<1&&u>=-EPS&&u<=1+EPS) ts.push(t);
    } else for(const p of [c,d]) if(onSegment(p,a,b)) ts.push(((p.x-a.x)*dx+(p.y-a.y)*dy)/l);
  }
  const sorted=[...new Set(ts)].sort((a,b)=>a-b);
  return sorted.slice(1).map((t,i)=>{const mid=(t+sorted[i])/2;return {x:a.x+dx*mid,y:a.y+dy*mid};});
}
export function containsPolygon(outer:Point[],inner:Point[]):boolean {
  return inner.every(p=>pointLocation(p,outer)!=='outside') && edges(inner).every(([a,b])=>edgeSamples(a,b,outer).every(p=>pointLocation(p,outer)!=='outside'));
}
export function polygonRelation(a:Point[],b:Point[]):'overlap'|'touch'|'disjoint' {
  let touches=false;
  for(const [p,q] of edges(a)) for(const [r,s] of edges(b)) {
    const relation=segmentRelation(p,q,r,s);
    if(relation==='cross') return 'overlap';
    if(relation==='touch') touches=true;
  }
  for(const [x,y] of [[a,b],[b,a]]) {
    if(x.some(p=>pointLocation(p,y)==='inside')) return 'overlap';
    for(const [p,q] of edges(x)) {
      if(edgeSamples(p,q,y).some(s=>pointLocation(s,y)==='inside')) return 'overlap';
      // Coincident boundaries with interiors on the same side imply area overlap.
      for(const [r,s] of edges(y)) if(onSegment(p,r,s)&&onSegment(q,r,s)) {
        const sameDirection=(q.x-p.x)*(s.x-r.x)+(q.y-p.y)*(s.y-r.y)>0;
        if(sameDirection === (signedArea(x)*signedArea(y)>0)) return 'overlap';
      }
    }
  }
  return touches?'touch':'disjoint';
}
export function polygonDistance(a:Point[],b:Point[]) {
  if(polygonRelation(a,b)!=='disjoint') return {distance:0,P:a[0],Q:a[0]};
  let best={distance:Infinity,P:a[0],Q:b[0]};
  for(const [x,y] of [[a,b],[b,a]]) for(const p of x) for(const [q,r] of edges(y)) {
    const closest=closestPoint(p,q,r),d=Math.hypot(p.x-closest.x,p.y-closest.y);
    if(d<best.distance) best={distance:d,P:p,Q:closest};
  }
  return best;
}
/** Minimum perpendicular wall-to-boundary distance along an outward unit normal. */
export function perpendicularClearance(a:Point,b:Point,normal:Point,target:Point[]):{P:Point;Q:Point;t:number}|null {
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<EPS*EPS)return null;
  const samples=[0,1];
  for(const p of target){const s=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2;if(s>0&&s<1)samples.push(s);}
  let best:{P:Point;Q:Point;t:number}|null=null;
  for(const s of samples){
    const p={x:a.x+s*dx,y:a.y+s*dy};let nearest=Infinity;
    for(const [q,r] of edges(target)){
      // A coincident starting point is a zero-distance hit, even for parallel edges.
      if(onSegment(p,q,r)){nearest=0;break;}
      const ex=r.x-q.x,ey=r.y-q.y,den=normal.x*ey-normal.y*ex;if(Math.abs(den)<1e-12)continue;
      const wx=q.x-p.x,wy=q.y-p.y,t=(wx*ey-wy*ex)/den,u=(wx*normal.y-wy*normal.x)/den;
      if(t>0&&u>=-EPS&&u<=1+EPS)nearest=Math.min(nearest,t);
    }
    if(Number.isFinite(nearest)&&(!best||nearest<best.t))best={P:p,Q:{x:p.x+normal.x*nearest,y:p.y+normal.y*nearest},t:nearest};
  }
  return best;
}
