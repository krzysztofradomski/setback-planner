import type { CatalogModel } from '../core/catalogs.ts';
const base='https://udanabudowa.pl/';
const models:[string,number,number,number,number|null,number|null][]=[
  ['75',11.76,7.84,3,75.6,92.2],
  ['105',13.1,9.98,3,null,null],
  ['135',16.1,9.98,3,null,null],
  ['165',18.08,10.8,4,164.76,null],
];
/** Dimensions are transcribed from dimension lines in the public manufacturer plans. */
export default {
  id:'udana-budowa',version:'2026-11-16-plans-1',name:'Udana Budowa',source:base,retrievedAt:'2026-11-16',
  models:models.map(([size,width,depth,planNumber,floorArea,footprintArea]):CatalogModel=>{
    const photoOriginal=`${base}img/dom${size}_01.jpg`,planOriginal=`${base}img/dom${size}_0${planNumber}.jpg`;
    return {
      id:`de-${size}`,version:'plan-1',name:`DE ${size}`,source:base,
      footprint:{width,depth,kind:'bounding-envelope',source:planOriginal},
      floorArea,floorAreaKind:floorArea===null?null:size==='75'?'usable':'total',footprintArea,price:null,height:null,
      roof:{type:'gable',pitch:null,source:photoOriginal},geometryStatus:'verified-envelope',
      thumbnail:`/assets/udana-budowa/de-${size}-photo.webp`,plan:`/assets/udana-budowa/de-${size}-plan.webp`,
      assets:{photoOriginal,planOriginal,attribution:'Udana Budowa — udanabudowa.pl'},
      notes:[
        'Wymiary zewnętrzne obrysu odczytano z linii wymiarowych rzutu producenta (cm → m). Prostokąt obejmuje wnękę wejściową; nie jest szczegółowym obrysem ścian.',
        'Obrys nie obejmuje tarasu, wiaty, okapów ani innych dodatków. Model 3D jest poglądowy: wysokość i kąt dachu są ustawieniami edytora, nie danymi producenta.',
        'Układ okien i drzwi oraz parametry dachu wymagają potwierdzenia w wybranej dokumentacji projektu. Rzut parteru nie potwierdza braku otworów na całej elewacji.',
        ...(size==='165'?['Wybrano rzut dom165_04.jpg (164,76 m²). Warianty _05 i _06 mają ten sam obrys 1808 × 1080 cm oraz inne układy wnętrza.']:[]),
      ],
    };
  }),
};
