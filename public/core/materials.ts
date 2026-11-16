import { z } from 'zod';
const preset=(en:string,pl:string,color:string,pattern:'plain'|'brick'|'boards',tileWidth=0.25,tileHeight=0.065,roughness=0.8)=>Object.freeze({en,pl,color,pattern,tileWidth,tileHeight,roughness,confirmation:'conceptual' as const});
export const materialPresets=Object.freeze({
  plaster:preset('Painted plaster','Tynk malowany','#e8e2d5','plain'),
  'plaster-grey':preset('Light grey plaster','Tynk jasnoszary','#c9cbcb','plain'),
  'plaster-white':preset('White plaster','Tynk biały','#efefec','plain'),
  'brick-red':preset('Dark red brick slips','Płytki ceglane ciemnoczerwone','#873d32','brick'),
  'brick-terracotta':preset('Terracotta brick slips','Płytki ceglane terakota','#b96640','brick'),
  'brick-grey':preset('Grey brick slips','Płytki ceglane szare','#858583','brick'),
  'brick-brown':preset('Brown brick slips','Płytki ceglane brązowe','#6c4b3d','brick'),
  wood:preset('Wood cladding','Okładzina drewniana','#b98b59','boards',0.15,1.5),
  clinker:preset('Clinker','Klinkier','#754237','brick',0.24,0.071),
  stone:preset('Stone veneer','Okładzina kamienna','#a6a090','brick',0.4,0.2),
  concrete:preset('Architectural concrete','Beton architektoniczny','#afb1ad','plain',1.2,0.6),
  composite:preset('Composite panels','Panele kompozytowe','#666d6c','boards',0.2,2),
});
export const materialIdSchema=z.enum(['plaster','plaster-grey','plaster-white','brick-red','brick-terracotta','brick-grey','brick-brown','wood','clinker','stone','concrete','composite']);
const color=z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const appearanceSchema=z.object({
  facade:materialIdSchema.optional(),walls:z.record(z.string().regex(/^(?:[0-9]|[12][0-9]|3[01])$/),materialIdSchema).optional(),
  roofCovering:z.enum(['metal','tile','shingle','membrane']).optional(),doorColor:color.optional(),grout:color.optional(),roofColor:color.optional(),frameColor:color.optional(),gutterColor:color.optional(),trimColor:color.optional(),
  tileWidth:z.number().finite().min(0.02).max(3).optional(),tileHeight:z.number().finite().min(0.02).max(3).optional(),
  layout:z.enum(['horizontal','vertical']).optional(),
}).strict();
export type AppearanceOverrides=z.infer<typeof appearanceSchema>;
const base=Object.freeze({roofCovering:'metal' as const,doorColor:'#554a3e',facade:'plaster' as const,grout:'#c7bfb2',roofColor:'#43494c',frameColor:'#333a3b',gutterColor:'#444b4c',trimColor:'#ded6c5',layout:'horizontal' as const});
export function resolveAppearance(overrides:AppearanceOverrides={}){
  const merged={...base,...appearanceSchema.parse(overrides)},material=materialPresets[merged.facade];
  return {...merged,walls:{...overrides.walls},tileWidth:merged.tileWidth??material.tileWidth,tileHeight:merged.tileHeight??material.tileHeight};
}
export function resetAppearance(overrides:AppearanceOverrides,key?:keyof AppearanceOverrides):AppearanceOverrides {
  const next=structuredClone(overrides);if(!key)return {};delete next[key];return next;
}
