import * as SunCalc from 'suncalc';
export function sunPosition(date:string,latitude:number,longitude:number){
 if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180||!Number.isFinite(Date.parse(date)))throw new Error('Invalid solar inputs');
 // SunCalc 2 uses degrees and clockwise azimuth from north. Domain angles use radians.
 const raw=SunCalc.getPosition(new Date(date),latitude,longitude),azimuth=raw.azimuth*Math.PI/180,altitude=raw.altitude*Math.PI/180,c=Math.cos(altitude);
 return {azimuth,altitude,direction:{x:Math.sin(azimuth)*c,y:Math.sin(altitude),z:-Math.cos(azimuth)*c},daylight:altitude>0};
}
export const seasonalGround={spring:'#8eae74',summer:'#94ad7c',autumn:'#a49b68',winter:'#e4e6e1'};
