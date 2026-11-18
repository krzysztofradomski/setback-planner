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
/** Ground-floor walls transcribed by hand from each manufacturer plan (dimension lines, 5–10 cm reading accuracy):
 *  centrelines [x0, y0, x1, y1, thickness?] in metres from the footprint's top-left; partitions default to 14 cm. */
const interiors:Record<string,[number,number,number,number,...number[]][]>={
  '75':[[0,0.17,11.76,0.17,0.34],[0.17,0,0.17,7.84,0.34],[11.59,0,11.59,7.84,0.34],[0,7.65,11.76,7.65,0.39],[3.82,0.34,3.82,4],[3.82,3.98,4.95,3.98],[5.78,3.98,6.66,3.98],[6.66,0.34,6.66,4],[0.34,3.39,1.8,3.39],[2.99,3.39,3.82,3.39],[3.03,2.53,3.03,3.39],[1.9,3.39,1.9,3.55],[1.9,4.37,1.9,5.27],[0.34,5.08,1.9,5.08],[3.03,5.27,3.03,7.45],[2.84,5.27,3.68,5.27],[4.56,5.27,5.64,5.27],[6.91,5.27,7.47,5.27],[5.36,5.27,5.36,7.45],[7.47,5.27,7.47,7.45]],
  '105':[[0,0.19,13.1,0.19,0.38],[12.91,0,12.91,9.98,0.38],[0.19,0,0.19,8.1,0.38],[0,7.95,3.5,7.95,0.3],[3.35,7.95,3.35,9.98,0.3],[3.35,9.79,13.1,9.79,0.38],[6.58,0.38,6.58,4.97],[6.58,4.95,8.4,4.95],[9.65,0.38,9.65,4.97],[10.95,4.4,12.72,4.4],[10.9,4.4,10.9,5.2],[10.9,5.95,10.9,6.33],[10.64,6.33,12.72,6.33],[9,6.38,9.8,6.38],[9,6.33,9,9.6],[7.5,6.33,9,6.33],[6.51,6.33,6.51,7.83],[6.51,7.83,9,7.83],[5.97,7.83,5.97,8.6],[3.42,4.9,3.42,7.85],[4.4,4.9,4.4,7.85],[3.42,4.9,4.4,4.9],[3.42,7.85,4.45,7.85]],
  '135':[[0,0.19,16.1,0.19,0.38],[15.91,0,15.91,9.98,0.38],[0.19,0,0.19,8.05,0.38],[0,7.87,2.85,7.87,0.34],[2.85,7.87,2.85,9.98,0.34],[2.85,9.79,16.1,9.79,0.38],[7.94,0.38,7.94,4.95],[7.94,4.3,10.2,4.3],[10.25,4.3,10.25,4.95],[11.38,0.38,11.38,4.95],[12.55,3.72,15.72,3.72],[12.6,3.72,12.6,4.95],[12.6,6.17,15.72,6.17],[4.83,6.15,6.04,6.15],[6.98,6.15,9.66,6.15],[10.8,6.15,11.6,6.15],[2.9,4.94,2.9,7.78],[3.89,4.94,3.89,7.78],[2.9,4.94,3.89,4.94],[6,6.15,6,7.78],[5.2,7.78,8.37,7.78],[5.2,7.78,5.2,8.72],[8.37,6.15,8.37,9.6],[10.8,6.15,10.8,9.6],[14.15,6.17,14.15,7.3],[14.15,8.2,14.15,9.6]],
  '165':[[0,0.17,18.08,0.17,0.34],[0.17,0,0.17,10.8,0.34],[17.91,0,17.91,10.8,0.34],[0,10.6,18.08,10.6,0.4],[5.9,0.33,5.9,4.58],[5.9,4.58,6.6,4.58],[7.45,4.58,10.6,4.58],[11.45,4.58,13.15,4.58],[8.42,0.33,8.42,4.58],[11.5,0.33,11.5,4.58],[14.6,0.33,14.6,2.9],[13.3,2.9,14.6,2.9],[13.3,2.9,13.3,4.58],[15,3.9,17.74,3.9],[14.6,3.9,14.6,5],[14.6,5.9,14.6,6.45],[14.6,6.45,17.74,6.45],[4.75,6.48,6.6,6.48],[7.99,6.5,9.8,6.5],[10.6,6.5,11.9,6.5],[12.73,6.5,14.6,6.5],[10.97,6.5,10.97,10.4],[8.86,6.5,8.86,10.4],[15.45,6.5,15.45,7.9],[15.45,8.9,15.45,10.4],[6.75,6.5,6.75,8],[6.75,9,6.75,10.4],[8.05,7,8.05,10.4],[5.47,6.5,5.47,8.1],[4.75,8.15,6.75,8.15],[4.8,8.15,4.8,9.8],[4.8,6.5,4.8,7.6]],
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
      roof:{type:'gable',pitch:null,source:photoOriginal},geometryStatus:'verified-envelope',exterior:{...exteriors[size],interior:{walls:interiors[size]}},
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
