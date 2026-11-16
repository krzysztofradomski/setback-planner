# Geospatial contracts and sources

Checked 2026-11-16:

- [Polish state reference system, Dz.U. 2024 poz.342](https://dziennikustaw.gov.pl/D2024000034201.pdf), annex 4: PL-1992 uses central meridian 19°, scale 0.9993, false easting 500000 m and false northing -5300000 m; GRS80. This establishes transformation parameters, not a legal building assessment.
- [Proj4js](https://proj4js.org/): explicit source/target transformations. WGS84 to ETRS89 is a planning approximation without epoch/grid corrections; projected distances are not certified ground survey distances.
- [GeoJSON RFC 7946](https://datatracker.ietf.org/doc/html/rfc7946): longitude/latitude order and closed polygon rings. Imported PL-1992 JSON uses an explicit CRS selector and easting/northing tuple order; it is not RFC 7946 WGS84 GeoJSON.
- [GUGiK ULDK API](https://uldk.gugik.gov.pl/opis.html): parcel lookup and WKT output contracts; integration is F010.

Scene x is east and y is south in local projected metres. `coordinates.projected.origin` stores easting/northing in PL-1992. Recover original projected coordinates as E = origin.x + x, N = origin.y - y. North arrow denotes grid north, not a surveyed true-north bearing.

Supported import: one simple closed Polygon ring, or MultiPolygon containing exactly one simple ring, directly or in one Feature/FeatureCollection. Up to 512 vertices and 256 KiB. Reject holes, separate components, implicit legacy CRS declarations, invalid/self-crossing rings and unsupported coordinates. F025 tracks full topology support; no geometry is silently dropped.

Provenance includes source filename/service, source CRS and retrieval timestamp. Manual boundary edits flag the source geometry as changed. Creating a new rectangle clears georeferencing/provenance. Building local coordinates are retained after parcel replacement; users must verify placement. Import is one undoable operation.
