import type { CatalogModel, CatalogExterior } from '../core/catalogs.ts';
type O=CatalogExterior['openings'][number];
const win=(wall:O['wall'],center:number,width:number,height:number):O=>({wall,center,width,height,head:2.3,type:'window'});
const door=(wall:O['wall'],center:number,width:number):O=>({wall,center,width,height:2.3,head:2.3,type:'door'});
// Shared finishes seen in all four renders: warm grey plaster or concrete walls, white eaves band, oak joinery, graphite tiled gable roof.
const finishes={eavesHeight:3.3,pitch:38,overhang:.35,gableOverhang:.25,heightSource:'render-estimate' as const,band:{height:.55,color:'#d9d5cd'},
  frameColor:'#a8743f',doorColor:'#9a6533',roofColor:'#2b2d30',roofCovering:'tile' as const,gutterColor:'#3a3d41',openingsSource:'plan' as const,detailsSource:'render-estimate' as const};
/** Openings: centres and sizes (width/height in the plan's "W/H" labels, heads at 230 cm) measured on the manufacturer plans.
 *  Wall material, cladding zones, canopy, PV, roof windows, chimneys, eaves height and pitch are estimates from the renders. */
const exteriors:Record<string,CatalogExterior>={
  '75':{...finishes,eavesHeight:3.2,pitch:30,wall:'plaster-warm-grey',
    openings:[win('front',1.68,1,1.45),win('front',4.23,1,1.45),door('front',6.51,1),win('front',9.42,2.5,1.45),win('back',2.06,1.8,2.3),win('back',5.3,1,2.3),win('back',9.02,2.5,2.3),win('right',3.94,1.8,2.3)],
    claddings:[],canopy:{wall:'front',center:6.51,width:2,depth:.9},roof:{pv:{side:'front',from:.53,to:.96},windows:[],chimneys:[]},
    carport:{kind:'carport',side:'left',width:3.6,depth:6,fromFront:0,height:2.6,source:'render-estimate'}},
  '105':{...finishes,wall:'plaster-warm-grey',
    openings:[win('front',1.85,1.45,1.45),door('front',5.38,.9),win('front',10.64,1.8,2.3),win('back',2.71,2.7,2.3),win('back',8.51,1.8,2.3),win('back',10.81,1.8,2.3),win('right',5.89,.6,1.1)],
    claddings:[{wall:'front',from:0,to:.55,material:'plaster-white'},{wall:'front',from:.55,to:3.04,material:'wood-larch'},{wall:'front',from:3.04,to:3.4,material:'plaster-white'},{wall:'front',from:11.4,to:13.1,material:'plaster-white'}],canopy:null,roof:{pv:{side:'front',from:.05,to:.5},windows:[{side:'front',at:.55},{side:'front',at:.8}],chimneys:[.28,.61]},
    carport:{kind:'carport',side:'left',width:3.9,depth:6,fromFront:1.91,height:2.6,source:'plan'}},
  '135':{...finishes,wall:'plaster-warm-grey',
    openings:[win('front',1.49,1.45,1.45),door('front',2.4,1),win('front',4.15,.9,1.45),win('front',6.61,.9,1.45),win('front',9.31,1.6,2.3),win('front',13.14,1.8,2.3),win('back',3.44,4,2.3),win('back',10.06,1.8,2.3),win('back',13.5,1.8,2.3),win('right',5.52,.6,1.45)],
    claddings:[{wall:'front',from:4.7,to:12.3,material:'wood-larch'}],canopy:null,roof:{pv:{side:'front',from:.45,to:.97},windows:[{side:'front',at:.2},{side:'front',at:.27}],chimneys:[]},
    carport:{kind:'carport',side:'left',width:4,depth:6.2,fromFront:2.12,height:2.7,source:'plan'}},
  '165':{...finishes,wall:'concrete-warm',
    openings:[win('front',2.55,3,1.4),door('front',7.5,1.1),win('front',10.39,1,2.3),win('front',13.17,1.8,2.3),win('back',3.19,4,2.3),win('back',7.2,1.2,2.3),win('back',10.09,1.2,2.3),win('back',13.29,1.2,2.3),win('back',16.03,1.2,2.3),win('left',5.19,4,2.3),win('right',5.23,1,1.4)],
    claddings:[],canopy:{wall:'front',center:7.5,width:2.6,depth:1},roof:{pv:{side:'front',from:.45,to:.97},windows:[{side:'front',at:.2},{side:'front',at:.25},{side:'front',at:.42}],chimneys:[]},
    carport:{kind:'garage',side:'left',width:3.4,depth:6,fromFront:0,height:2.7,door:'#3d3f42',source:'render-estimate'}},
};
/** Outer wall corners of the footprint on each bundled plan image, as fractions of the image (measured on the drawings). */
const planCrops:Record<string,{x0:number;y0:number;x1:number;y1:number}>={
  '75':{x0:0.2985,y0:0.3098,x1:0.7015,y1:0.6895},
  '105':{x0:0.339,y0:0.3239,x1:0.7885,y1:0.8084},
  '135':{x0:0.205,y0:0.2405,x1:0.795,y1:0.7581},
  '165':{x0:0.0883,y0:0.1437,x1:0.9543,y1:0.8592},
};
const base='https://udanabudowa.pl/';
const models:[string,number,number,number,number|null,number|null][]=[
  ['75',11.76,7.84,3,75.6,92.2],
  ['105',13.1,9.98,3,null,null],
  ['135',16.1,9.98,3,null,null],
  ['165',18.08,10.8,4,164.76,null],
];
/** Dimensions are transcribed from dimension lines in the public manufacturer plans. */
export default {
  id:'udana-budowa',version:'2026-11-16-plans-2',name:'Udana Budowa',source:base,retrievedAt:'2026-11-16',
  models:models.map(([size,width,depth,planNumber,floorArea,footprintArea]):CatalogModel=>{
    const photoOriginal=`${base}img/dom${size}_01.jpg`,planOriginal=`${base}img/dom${size}_0${planNumber}.jpg`;
    return {
      id:`de-${size}`,version:'plan-1',name:`DE ${size}`,source:base,
      footprint:{width,depth,kind:'bounding-envelope',source:planOriginal},
      floorArea,floorAreaKind:floorArea===null?null:size==='75'?'usable':'total',footprintArea,price:null,height:null,
      roof:{type:'gable',pitch:null,source:photoOriginal},geometryStatus:'verified-envelope',exterior:{...exteriors[size],floorPlan:{src:`/assets/udana-budowa/de-${size}-plan.webp`,...planCrops[size]}},
      thumbnail:`/assets/udana-budowa/de-${size}-photo.webp`,plan:`/assets/udana-budowa/de-${size}-plan.webp`,
      assets:{photoOriginal,planOriginal,attribution:'Udana Budowa — udanabudowa.pl'},
      notes:[
        'Wymiary zewnętrzne obrysu odczytano z linii wymiarowych rzutu producenta (cm → m). Prostokąt obejmuje wnękę wejściową; nie jest szczegółowym obrysem ścian.',
        'Okna i drzwi: położenie i wymiary (szer./wys.) odczytane z rzutu producenta, nadproża na 230 cm. Materiały elewacji, pas pod okapem, okładzina drewniana, fotowoltaika, okna dachowe, kominy, wysokość okapu i kąt dachu odwzorowano z wizualizacji — są przybliżone.',
        'Obrys nie obejmuje tarasu ani okapów. Wiata z rzutu (DE 105, DE 135) jest dodawana jako osobny, zgrupowany obiekt i podlega sprawdzeniu odległości. Wiata DE 75 i garaż DE 165 występują tylko na wizualizacjach — ich wymiary są szacunkowe i należy je potwierdzić u producenta.',
        'Układ okien i drzwi oraz parametry dachu wymagają potwierdzenia w wybranej dokumentacji projektu. Rzut parteru nie potwierdza braku otworów na całej elewacji.',
        ...(size==='165'?['Wybrano rzut dom165_04.jpg (164,76 m²). Warianty _05 i _06 mają ten sam obrys 1808 × 1080 cm oraz inne układy wnętrza.']:[]),
      ],
    };
  }),
};
