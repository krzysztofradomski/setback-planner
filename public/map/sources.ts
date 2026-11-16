/** Provider endpoints checked against official capabilities on 2026-11-16. */
export const mapSources={
  osm:{type:'raster' as const,tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'},
  ortho:{type:'raster' as const,tiles:['https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/jpeg&LAYERS=Raster&STYLES=&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}'],tileSize:256,minzoom:10,maxzoom:20,attribution:'Ortofotomapa © <a href="https://www.geoportal.gov.pl/">GUGiK / Geoportal</a>'},
  cadastre:{type:'raster' as const,tiles:['https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=TRUE&LAYERS=dzialki,numery_dzialek,budynki&STYLES=&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}'],tileSize:256,minzoom:14,maxzoom:20,attribution:'EGiB © <a href="https://www.geoportal.gov.pl/">GUGiK / powiaty</a>'},
};
