# Implementation status

Work branch: `codex/scene-foundation`. Feature order and acceptance criteria live in `features.json`; dependencies determine the next unblocked feature. No production deployment has been performed.

## Current work

F001 completed: inventory, build, lint, typecheck and three browser regressions passed. Existing SVG editor retained. Read `repository-audit.md` for architectural decisions and source checks.

## Resume

F002 completed: validated simple-ring geometry, explicit touching/overlap classification, concave containment, transform invariance. SVG checks use the shared module. Next: F003 canonical scene. Keep each completed feature in a separate reviewed/tested commit. Never mark an entire broad capability complete because only its foundation exists.

Dependency review: transitive minimatch override uses patched 11.x; npm audit reports zero vulnerabilities. Review: containment boundary behavior is explicit; touching buildings are flagged; no planning-law claims added.

F003 completed: strict v2 scene, atomic legacy migration, bounded decompression, full-state sharing, latest-edit clipboard sharing, and startup recovery without overwriting unsupported stored projects. Tests: 9 unit and 5 browser tests. Next: F004 project files, variants and full undo/redo.

F004 completed: JSON files, 20 named local variants, full-scene undo/redo, detached duplication, and settings recovery. Review covered storage failures, invalid imports, undo after import, ID regeneration and redo invalidation. 11 unit/6 browser tests pass; build/lint/typecheck pass. Next: F005 generic footprints.

F005 completed: generic rectangle/L/T/U footprints, wing proportion, storeys, height, roof and pitch settings. SVG, coverage and collision checks use shared transformed footprints; resizing retains four bounding handles. ID validation prevents markup injection via data attributes. Review verified concave wall iteration and independent duplicated architecture. 13 unit/7 browser tests pass. Next: F006 materials.

F006 completed: 10 material presets including four brick-slip colors, wall-specific finishes, physical tile size/direction, grout/roof/frame/gutter/trim colors, original comparison and resets. Defaults remain immutable; overrides serialize separately. Review caught and fixed details collapsing on shape change. 15 unit/8 browser tests pass. Next: F007 optional catalog metadata, then F008 3D.

F007 completed: trusted explicit registry, lazy metadata module, default enabled preference, date/source/model versions, disable/re-enable behavior and saved geometry preservation. No dimensions, renders or prices invented. Review verified unregistered module rejection and no privileged data access. 17 unit/9 browser tests pass. Next: F008 synchronized 3D.

F008 completed: synchronized on-demand Three.js massing view, per-wall physical texture repeats, roof pitch for rectangles, orbit/pan/zoom, top/axonometric views, PNG screenshot and low-power mode. Mobile/WebGL fallback and repeated-edit GPU resource checks pass. Visual screenshot inspected. Review fixed removed Three.js shadow constant and preflighted unsupported WebGL without renderer errors. Screenshot tests ignore only the Chromium GPU ReadPixels diagnostic produced by readback; application warnings/errors remain test failures. Full requested 3D scope (openings/walkthrough/terrain/complex roofs) remains queued. Next: F009 CRS-aware parcel import.

F009 completed for single-ring parcels: explicit WGS84/PL-1992 import, arbitrary vertex editing, projected origin, grid north and source/edit metadata. 22 unit/13 browser tests pass; typecheck/lint/build pass. The backlog separates holes and multipart topology into F025 instead of silently dropping them. Next: F010 ULDK identifier lookup.

F010 completed: ULDK full-identifier lookup, streamed size/time bounds, conservative UI request spacing, real response fixture, outage handling and late-response protection. 25 unit tests and 3 additional ULDK browser journeys pass; build/lint/typecheck pass. Map selection is separated into F026. Next: F011 geographic map view.

F011 completed: optional MapLibre view, OSM streets, GUGiK orthophoto and cadastre/building raster context, geographic scene overlay, compass and attribution. Review found/fixed explicit worker asset bundling for MapLibre 6; idle-state and console error checks cover worker readiness. 27 unit tests and 2 map browser journeys pass; build/typecheck/lint pass. Next: F026 map selection, then remaining source/rule features or report exports.

F026 completed: explicit map-click parcel selection with validated returned identity and shared ULDK safeguards. 28 unit tests and 6 focused map/ULDK browser journeys pass. Next available independent feature: F018 printable reports and SVG exports. F012–F017 need additional source-backed environmental, rule, landscaping and AI work.
