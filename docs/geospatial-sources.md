# Geospatial contracts and sources

Checked 2026-11-16:

- [Polish state reference system, Dz.U. 2024 poz.342](https://dziennikustaw.gov.pl/D2024000034201.pdf), table 10 (printed pages 14–15): PL-1992 uses central meridian 19°, scale 0.9993, false easting 500000 m and false northing -5300000 m; GRS80. This establishes transformation parameters, not a legal building assessment.
- [Proj4js](https://proj4js.org/): explicit source/target transformations. WGS84 to ETRS89 is a planning approximation without epoch/grid corrections; projected distances are not certified ground survey distances.
- [GeoJSON RFC 7946](https://datatracker.ietf.org/doc/html/rfc7946): longitude/latitude order and closed polygon rings. Imported PL-1992 JSON uses an explicit CRS selector and easting/northing tuple order; it is not RFC 7946 WGS84 GeoJSON.
- [GUGiK ULDK API](https://uldk.gugik.gov.pl/opis.html): parcel lookup and WKT output contracts; integration is F010.

Scene x is east and y is south in local projected metres. `coordinates.projected.origin` stores easting/northing in PL-1992. Recover original projected coordinates as E = origin.x + x, N = origin.y - y. North arrow denotes grid north, not a surveyed true-north bearing.

Supported import: one simple closed Polygon ring, or MultiPolygon containing exactly one simple ring, directly or in one Feature/FeatureCollection. Up to 512 vertices and 256 KiB. Reject holes, separate components, implicit legacy CRS declarations, invalid/self-crossing rings and unsupported coordinates. F025 tracks full topology support; no geometry is silently dropped.

Provenance includes source filename/service, source CRS and retrieval timestamp. Manual boundary edits flag the source geometry as changed. Creating a new rectangle clears georeferencing/provenance. Building local coordinates are retained after parcel replacement; users must verify placement. Import is one undoable operation.

## ULDK identifier lookup

`GetParcelById`, `result=geom_wkt`, `srid=2180`, exact full identifier only. Official example `141201_1.0001.6509` returned a seven-vertex polygon on 2026-11-16; fixture is stored under `tests/fixtures/uldk-parcel.txt`. Live response included `Access-Control-Allow-Origin: *`. Availability is not guaranteed by this observation.

Browser sends the user-entered identifier directly to GUGiK; the UI discloses this. Credentials and referrer are omitted; redirects are refused; no automatic retries or retained remote cache; at most one UI request per two seconds. Timeout: 10 seconds; streamed response limit: 256 KiB. No bulk service mirroring. The current API FAQ states per-IP limits of 200 requests/minute during 06:00–18:00 and 40/minute otherwise, plus 10,000/day. The UI spacing is a safeguard below the smaller minute allowance; other users/tabs sharing an IP can still exhaust the provider quota.

Success is strictly one status line `0` plus WKT with the requested SRID. Invalid data and upstream failures leave the project untouched. A response arriving after project edits is discarded. Service attribution and retrieval time persist with the parcel.

## Map providers

Sources verified against [GUGiK service listing](https://www.geoportal.gov.pl/pl/usluga/uslugi-przegladania-wms-i-wmts/) and live ORTO/KIEG GetCapabilities on 2026-11-16. ORTO layer `Raster`; KIEG layers `dzialki,numery_dzialek,budynki`. Both advertise EPSG:3857; requests use WMS 1.1.1 easting/northing BBOX order. KIEG requests start at zoom 14; orthophoto at zoom 10. No prefetch or bulk download.

Street tiles: [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/). Browser-managed caching and normal Referer/User-Agent are retained; visible attribution links to OSM copyright. Tile sources are centralized in `public/map/sources.ts` for provider changes. No service proxy, cache bypass, offline download, or hidden attribution.

[MapLibre official WMS example](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-wms-source/) informed source integration. The module worker is explicitly bundled and served from the same origin. Maps are optional and retain the 2D editor when unavailable. Provider failures are visible; image dates and neighboring heights are unknown. Nearby structures shown on imagery/cadastral rasters are visual context, not imported planning geometry.

Map selection uses an explicit one-click selection mode; navigation clicks do not request parcels. `GetParcelByXY` sends longitude,latitude,4326 and requests `id,geom_wkt` in PL-1992. The returned full identifier is validated before import. Live response `id|SRID=2180;POLYGON(...)` was checked using a point inside the official example parcel on 2026-11-16. The same timeout, byte limit, request spacing and stale-project protection apply to map lookup.

## Terrain and additional overlays — checked 2026-11-16

GUGiK NMT https://services.gugik.gov.pl/nmt/ supports GetHByPointList with northing/easting coordinate pairs (unlike ordinary x=easting CRS notation). Nine bounded samples provide approximate interpolated terrain and slope; vertical datum is recorded as unspecified. Changing the parcel clears old terrain. This is not a survey or terrain-aware foundation design.

WMS capabilities were checked for GUGiK KrajowaIntegracjaMiejscowychPlanowZagospodarowaniaPrzestrzennego (plany/plany_granice), KrajowaIntegracjaUzbrojeniaTerenu (gesut), and https://sdi.gdos.gov.pl/wms protected areas. GDOŚ advertises EPSG:900913 (Web Mercator alias). Layers are optional raster context; imagery does not establish a legally applicable restriction or complete utility inventory. Provider capture dates and local coverage may be unknown.

## Source alignment with Gruntometr — checked 2026-11-16

The public [Gruntometr example](https://gruntometr.pl/przykladowy-raport) identifies EGiB/KIEG, KIMPZP, GESUT/KIUT, ISOK, GDOŚ, NMT, RCN, BDOT10k, PRG/EMUiA, OSRM, PSH, SOPO, MIDAS, CBDH, SIDUSIS/UKE, NID and ADS-B. Its linked public report's map documents expose direct official WMS URLs. We use these official providers directly; no Gruntometr API, report data, cached tiles or report findings are dependencies of the product. Shared providers do not imply the same analysis or results. The source directory separates integrated map/data services from external references.

Additional sources, exact layers and evidence:

| Overlay | Official endpoint / layers | Verification and limits |
| --- | --- | --- |
| Flood | [ISOK MZP/MRP WMS](https://wody.isok.gov.pl/wss/INSPIRE/INSPIRE_NZ_HY_MZPMRP_WMS?SERVICE=WMS&REQUEST=GetCapabilities), `NZ.Fluvial,NZ.RiskZone,NZ.ExposedElement_q10,NZ.ExposedElement_q1,NZ.ExposedElement_q0_2` | Listed by [ISOK INSPIRE](https://www.isok.gov.pl/inspire.html). Capabilities and 256px GetMap returned 200; PNG and CORS `*`. This is the same layer selection exposed in the public Gruntometr flood map. It includes hazard and exposed-element/risk context, not a parcel Q-zone classifier. |
| Groundwater flooding | [PIG-PIB WMS](https://cbdgmapa.pgi.gov.pl/arcgis/services/hydrogeologia/podtopienia/MapServer/WMSServer?SERVICE=WMS&REQUEST=GetCapabilities), `0` | Listed by [CBDG service directory](https://baza.pgi.gov.pl/cbdg/geoportal/uslugi/gis). Capabilities 200; GetMap 200 PNG. When sent an Origin header the image response echoed that Origin in Access-Control-Allow-Origin; bare capabilities responses had no CORS header. Separate from river flooding; no water-table depth is inferred. |
| Relief | [GUGiK shaded relief WMS](https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMT/GRID1/WMS/ShadedRelief?SERVICE=WMS&REQUEST=GetCapabilities), `Raster` | Capabilities 200; EPSG:3857 GetMap returned 200 PNG with CORS `*`, although that CRS was omitted from the capabilities CRS list. Use is based on the successful actual request; future failure remains possible. Gruntometr currently uses its own cached tile proxy with this WMS as its documented fallback. We request the official WMS directly. |
| Plans | KIMPZP endpoint above, `raster,wektor-str,wektor-pow,wektor-lzb,wektor-lin,wektor-pkt,granice` | All names verified in current capabilities. Matches the public example's drawing stack. The previously used `plany,plany_granice` are also advertised, but the drawing stack shows additional municipal rendering. |

GetMap verification used WMS 1.1.1, EPSG:3857, BBOX `2280000,6800000,2300000,6820000`, width/height 256, PNG and a localhost Origin. No authentication was sent. These are availability observations, not coverage guarantees. Earlier Hydroportal application MapServer endpoints returned 401; the public INSPIRE endpoint above is independently accessible and avoids that endpoint entirely.

All added overlays use WMS 1.1.1 and easting/northing Web Mercator BBOX order. Flood and groundwater opacity is 0.7; relief is 0.65. Layers load only when selected. Provider errors remain visible and users can disable a failed overlay while retaining the basemap and project editor. Blank images can mean no published features, coverage gaps, scale limits or a service failure; they must not be interpreted as a clear risk assessment. No automated risk scoring, utility distances, plan interpretation, roads access, prices/valuation, landslide/mining analysis, soil classification or broadband analysis is implemented by these visual overlays.
