# Geospatial contracts and sources

Checked 2026-11-16:

- [Polish state reference system, Dz.U. 2024 poz.342](https://dziennikustaw.gov.pl/D2024000034201.pdf), annex 4: PL-1992 uses central meridian 19°, scale 0.9993, false easting 500000 m and false northing -5300000 m; GRS80. This establishes transformation parameters, not a legal building assessment.
- [Proj4js](https://proj4js.org/): explicit source/target transformations. WGS84 to ETRS89 is a planning approximation without epoch/grid corrections; projected distances are not certified ground survey distances.
- [GeoJSON RFC 7946](https://datatracker.ietf.org/doc/html/rfc7946): longitude/latitude order and closed polygon rings. Imported PL-1992 JSON uses an explicit CRS selector and easting/northing tuple order; it is not RFC 7946 WGS84 GeoJSON.
- [GUGiK ULDK API](https://uldk.gugik.gov.pl/opis.html): parcel lookup and WKT output contracts; integration is F010.

Scene x is east and y is south in local projected metres. `coordinates.projected.origin` stores easting/northing in PL-1992. Recover original projected coordinates as E = origin.x + x, N = origin.y - y. North arrow denotes grid north, not a surveyed true-north bearing.

Supported import: one simple closed Polygon ring, or MultiPolygon containing exactly one simple ring, directly or in one Feature/FeatureCollection. Up to 512 vertices and 256 KiB. Reject holes, separate components, implicit legacy CRS declarations, invalid/self-crossing rings and unsupported coordinates. F025 tracks full topology support; no geometry is silently dropped.

Provenance includes source filename/service, source CRS and retrieval timestamp. Manual boundary edits flag the source geometry as changed. Creating a new rectangle clears georeferencing/provenance. Building local coordinates are retained after parcel replacement; users must verify placement. Import is one undoable operation.

## ULDK identifier lookup

`GetParcelById`, `result=geom_wkt`, `srid=2180`, exact full identifier only. Official example `141201_1.0001.6509` returned a seven-vertex polygon on 2026-11-16; fixture is stored under `tests/fixtures/uldk-parcel.txt`. Live response included `Access-Control-Allow-Origin: *`. Availability is not guaranteed by this observation.

Browser sends the user-entered identifier directly to GUGiK; the UI discloses this. Credentials and referrer are omitted; redirects are refused; no automatic retries or retained remote cache; at most one UI request per two seconds. Timeout: 10 seconds; streamed response limit: 256 KiB. No bulk service mirroring. No published numerical service quota was found in the API description; limits here are client safeguards, not a provider allowance.

Success is strictly one status line `0` plus WKT with the requested SRID. Invalid data and upstream failures leave the project untouched. A response arriving after project edits is discarded. Service attribution and retrieval time persist with the parcel.
