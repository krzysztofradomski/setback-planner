import * as THREE from 'three';
import type {SceneItem} from '../core/scene.ts';
import type {CatalogExterior} from '../core/catalogs.ts';
import {resolveHouseOptions} from '../core/house-options.ts';
/** Illustrative equipment, not manufacturer installation drawings. Coordinates are local to the house. */
export function buildHouseSystems(item:SceneItem,exterior?:CatalogExterior){
 const root=new THREE.Group();root.name='house-systems';
 const options=resolveHouseOptions(item,exterior),h=item.architecture.height,hw=item.w/2,hd=item.d/2;
 const across=item.architecture.roofAxis==='width'?item.d:item.w;
 const rise=item.architecture.roof==='gable'?across/2*Math.tan(item.architecture.pitch*Math.PI/180):0;
 const body=new THREE.MeshStandardMaterial({color:'#e9e8e2',roughness:.83}),metal=new THREE.MeshStandardMaterial({color:'#444b50',roughness:.55,metalness:.3});
 const box=(g:THREE.Group,w:number,height:number,d:number,x:number,y:number,z:number,material=body)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,height,d),material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
 const system=(name:string)=>{const g=new THREE.Group();g.name=name;root.add(g);return g;};
 if(options.fireplace){
  const g=system('fireplace'),x=-hw*.35,z=-hd+.65;
  box(g,1.1,1.65,.65,x,.825,z);box(g,.85,.7,.03,x,.8,z+.34,metal);
  const flame=new THREE.MeshStandardMaterial({color:'#e18737',emissive:'#e18737',emissiveIntensity:.3,roughness:.9});box(g,.5,.2,.04,x,.6,z+.36,flame);
  const chimney=system('fireplace-chimney');chimney.userData.roofEquipment=true;
  box(chimney,.5,1.5,.5,-hw*.35,h+rise+.1,-.35);box(chimney,.7,.08,.7,-hw*.35,h+rise+.89,-.35,metal);
 }
 if(options.recuperation){
  const g=system('recuperation');
  // Centrala inside, with visible external intake/exhaust louvres and a roof terminal.
  box(g,.8,.75,.5,hw-.65,h-.6,-hd+.55);
  for(const z of [-hd+.8,-hd+1.5]){box(g,.04,.35,.4,hw+.035,h-.55,z,metal);for(let y=0;y<5;y++)box(g,.05,.025,.35,hw+.065,h-.7+y*.06,z,body);}
  const ducts=system('recuperation-ducts');ducts.userData.floorPlan=true;
  for(const z of [-hd*.45,hd*.45]){
   const duct=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,item.w*.7,12),body);duct.rotation.z=Math.PI/2;duct.position.set(0,2.5,z);ducts.add(duct);
   for(const x of [-hw*.45,0,hw*.45])box(ducts,.22,.06,.22,x,2.42,z);
  }
  ducts.visible=false;
  const terminal=system('recuperation-terminal');terminal.userData.roofEquipment=true;
  box(terminal,.22,.65,.22,hw*.45,h+rise-.02,-.5);box(terminal,.34,.07,.34,hw*.45,h+rise+.34,-.5,metal);
 }
 if(options.heatPump){
  const g=system('heat-pump'),x=hw+.5,z=hd-.9;
  box(g,.45,.12,.9,x,.1,z);box(g,.4,.85,.95,x,.6,z);
  for(const dz of [-.3,.3])box(g,.32,.15,.12,x,.2,z+dz,metal);
  const fan=new THREE.Mesh(new THREE.TorusGeometry(.31,.025,8,40),metal);fan.rotation.y=Math.PI/2;fan.position.set(x+.22,.62,z);g.add(fan);
  const grille=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.025,40),metal);grille.rotation.z=Math.PI/2;grille.position.copy(fan.position);g.add(grille);
  for(let i=-4;i<=4;i++)box(g,.035,.48,.015,x+.25,.62,z+i*.055,body);
  const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.6,10),metal);pipe.rotation.z=Math.PI/2;pipe.position.set(hw+.2,.35,z-.3);g.add(pipe);
 }
 // Empty builders allocate no renderer resources; dispose unused shared materials now.
 if(!root.children.length){body.dispose();metal.dispose();}
 return root;
}
