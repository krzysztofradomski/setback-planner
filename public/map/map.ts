import { Map, Marker, Popup, NavigationControl, AttributionControl, GeoJSONSource, setWorkerUrl, type RasterSourceSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
setWorkerUrl(workerUrl);
import { mapSources, isMapOverlay } from './sources.ts';
import { projectOverlay } from './overlay.ts';
import type { Scene } from '../core/scene.ts';
export function createParcelMap(container:HTMLElement,onError:(source?:string)=>void){
  const canvas=document.createElement('canvas'),context=canvas.getContext('webgl2');if(!context)throw new Error('Map WebGL unavailable');context.getExtension('WEBGL_lose_context')?.loseContext();
  const map=new Map({container,center:[19,52],zoom:5,minZoom:4,maxZoom:20,maxBounds:[[13,48],[25,56]],attributionControl:false,style:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#e5e8df'}}]}});
  map.addControl(new NavigationControl(),'top-right');map.addControl(new AttributionControl({compact:false}),'bottom-right');
  let loaded=false,current:Scene|null=null,base:'osm'|'ortho'|'none'='osm',cadastre=false,signature='',fittedOrigin='';const overlays=new Set<string>();let locationMarker:Marker|null=null;
  map.on('error',event=>onError('sourceId' in event&&typeof event.sourceId==='string'?event.sourceId:undefined));
  map.on('idle',()=>{container.dataset.ready='true';});
  function sources(){
    if(!loaded)return;
    for(const [id,source]of Object.entries(mapSources)){
      const visible=id==='cadastre'?cadastre:overlays.has(id)||base===id;
      if(visible&&!map.getSource(id)){
        map.addSource(id,source as RasterSourceSpecification);
        map.addLayer({id,type:'raster',source:id,paint:{'raster-opacity':id==='cadastre'?0.85:id==='relief'?0.65:['flood','groundwater','landslides','mining'].includes(id)?0.7:1}},'project-fill');
      }
      if(map.getLayer(id))map.setLayoutProperty(id,'visibility',visible?'visible':'none');
    }
    // Keep cadastre above either basemap when sources are added in a different order.
    if(map.getLayer('cadastre'))map.moveLayer('cadastre','project-fill');
  }
  function fitProject(){
    if(!loaded||!current)return;
    const ring=projectOverlay(current).features.filter(f=>f.properties?.kind==='parcel').flatMap(f=>f.geometry.coordinates[0]);
    if(!ring?.length)return;
    const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);map.fitBounds([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],{padding:70,duration:0,maxZoom:19});
  }
  function update(project:Scene){
    current=project;if(!loaded)return;
    const next=JSON.stringify([project.plot,project.plotHoles,project.plotParts,project.items,project.coordinates]);if(next===signature)return;signature=next;
    (map.getSource('project') as GeoJSONSource).setData(projectOverlay(project));
    const origin=JSON.stringify(project.coordinates.projected?.origin??null);
    if(origin!==fittedOrigin){fittedOrigin=origin;fitProject();}
  }
  const ready=new Promise<void>(resolve=>map.on('load',()=>{
    loaded=true;
    map.addSource('project',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    map.addLayer({id:'project-fill',type:'fill',source:'project',paint:{'fill-color':['match',['get','kind'],'parcel','#78a35a','#b06a3a'],'fill-opacity':0.25}});
    map.addLayer({id:'project-line',type:'line',source:'project',paint:{'line-color':['match',['get','kind'],'parcel','#294d2b','#ab542c'],'line-width':2}});
    sources();if(current)update(current);resolve();
  }));
  const observer=new ResizeObserver(()=>map.resize());observer.observe(container);
  return {ready,update,fitProject,
    focusLocation(longitude:number,latitude:number,label:string){if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||longitude<13||longitude>25||latitude<48||latitude>56)throw new Error('Outside supported region');locationMarker?.remove();locationMarker=new Marker({color:'#365f44'}).setLngLat([longitude,latitude]).setPopup(new Popup().setText(label.slice(0,300))).addTo(map);map.jumpTo({center:[longitude,latitude],zoom:17});},
    clearLocation(){locationMarker?.remove();locationMarker=null;},
    setBase(value:'osm'|'ortho'|'none'){base=value;sources();if(value==='ortho'&&map.getZoom()<10)map.jumpTo({zoom:10});},
    setOverlay(id:string,value:boolean){if(!isMapOverlay(id))return;if(value)overlays.add(id);else overlays.delete(id);sources();},
    setCadastre(value:boolean){cadastre=value;sources();},
    setActive(active:boolean){if(active)map.resize();},
    onClick(callback:(longitude:number,latitude:number)=>void){map.on('click',event=>callback(event.lngLat.lng,event.lngLat.lat));},
    dispose(){locationMarker?.remove();observer.disconnect();map.remove();},
  };
}
