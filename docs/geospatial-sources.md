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
