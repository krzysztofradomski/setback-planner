# Implementation status — 2026-11-16

Branch: `codex/scene-foundation`. Baseline: `04fc331`. All work is local and committed feature by feature. Production has not been deployed. `docs/features.json` is the machine-readable source of acceptance criteria, dependencies, evidence and limitations.

## Completed cohesive features

| ID | Implemented scope |
| --- | --- |
| F001 | Full baseline audit, Vite build, TypeScript domain tooling, lint and browser regressions |
| F002 | Validated simple-ring geometry, touching/overlap classification, concave containment, metric transforms and zero-distance clearance |
| F003 | Strict v2 canonical scene, atomic legacy JSON/#p/#z migration, full-state #s sharing, bounded decompression and safe storage recovery |
| F004 | JSON files, 20 local named variants, full-scene undo/redo, detached duplication and settings recovery |
| F005 | Generic rectangle/L/T/U footprints, wing proportions, storeys, wall height and roof parameters |
| F006 | Ten conceptual material presets, including four brick slips, per-wall finishes, physical repeat scale, grout/colors and reset/comparison |
| F007 | Explicit trusted catalog registry, lazy Udana Budowa metadata, source dates/versions and enable/disable with fallback preservation |
| F008 | On-demand synchronized Three.js massing, physical texture repeats, rectangular gable roofs, orbit/top/axonometric controls, PNG and low-power/WebGL fallback |
| F009 | WGS84/PL-1992 single-ring parcel import, arbitrary editable vertex counts, reversible projected origin, grid north and provenance/edit labels |
| F010 | ULDK identifier lookup, strict real-response fixture, byte/time/request bounds, outage fallback and stale-response protection |
| F011 | Optional MapLibre view, OSM streets, GUGiK orthophoto and cadastral/building raster context, geographic project overlays and attribution |
| F026 | Explicit map-click parcel selection with validated identity and shared ULDK protections |
| F018 | Metric SVG export, printable EN/PL reports, browser PDF saving, selected 3D image, source timestamps and explicit unverified requirements |

These entries are scoped slices, not claims that the entire requested product is finished. Detailed remaining scope is tracked rather than represented by working-looking stubs.

## Validation and review

- 32 unit tests: geometry, coordinate conversion, scene migration/sharing, storage variants, catalog lifecycle, materials, 2D/3D footprint consistency, ULDK integration and report escaping.
- 22 Playwright journeys: legacy editor, latest-edit links, invalid/future-state preservation, variants/files, generic shapes, materials, catalog disabling, arbitrary parcels, boundary contact, 320px Polish controls, reports, service failures, stale responses, map selection, WebGL fallback and repeated-edit GPU resource stability.
- Three additional production-build smoke journeys cover bundled MapLibre worker/layers, 3D and report/SVG export with `npm run test:production`.
- Typecheck, lint and build pass. `npm audit` reports zero vulnerabilities. The transitive minimatch override selects patched 11.x.
- A Polish report was printed to PDF, rendered with Poppler and inspected on both pages. The 3D screenshot was visually inspected.
- Live ULDK example geometry/CORS and point-query response were checked; ORTO/KIEG capabilities were checked. Automated tests mock providers and do not guarantee ongoing external availability.
- Review fixed zero-distance boundary hits, unsafe ID attributes, stale asynchronous URL/parcel results, shared mutable duplication, details collapsing, narrow toolbar clipping and MapLibre's explicit worker bundling.
- Browser screenshot tests ignore only Chromium's GPU ReadPixels diagnostic. Application warnings/errors remain failures in the 3D check. Map failure tests intentionally exercise unavailable upstream layers.

## Architecture and current limits

The existing SVG controller remains JavaScript. Typed geometry, scene, persistence, material, catalog, map and reporting modules are independent; both renderers use the same footprint function. React was not introduced because replacing the working renderer was unjustified by this work. See `repository-audit.md` and `geospatial-sources.md`.

Projects support up to 100 buildings and 512 parcel vertices; imports are bounded to 256 KiB. Holes and separate parcel parts are rejected explicitly (F025). Imported buildings retain local coordinates; users must check placement after parcel replacement. PL-1992 distances are planning measurements, not certified survey measurements.

3D is conceptual massing. Concave pitched roofs use a labeled flat cap. Doors/windows, normal maps, roof coverings, detailed manufacturer geometry, terrain, walkthrough and mature vegetation remain outstanding. Lighting is artistic and shadows approximate. Map imagery dates and neighboring heights are unknown.

Manufacturer metadata has verified model names only. No dimensions, floor/coverage areas, heights, prices or licensed renders were inferred. F023 is blocked specifically on authoritative drawings and asset rights. Disabling catalogs does not delete scene objects. Unknown references preserve saved fallback geometry.

Map/3D/projection/catalog/report code is lazy-loaded. Vite reports large optional chunks (Three.js about 148 KB gzip; MapLibre about 291 KB gzip plus its local worker/CSS). These do not load during ordinary 2D planning; further bundle optimization remains useful.

No D1/R2/Workers AI bindings, personal-data forms, accounts, showroom, commission workflows, staging resources or backend monitoring have been provisioned. The only Cloudflare configuration change is serving built `dist` assets instead of raw `public`. The existing production domain remains configured.

## Resume directly

1. Read `docs/features.json`, verify branch/worktree and preserve any new user changes.
2. Next dependency-ordered queued feature is **F012: terrain, planning and environmental layers**. Start by verifying authoritative provider capabilities, terms, coverage, freshness and output schemas. Do not invent a planning restriction or treat raster imagery as authoritative vector/height data.
3. F013 placement/rule work, F014–F016 landscaping/seasons, F019 staging/security/observability and F020 showroom can then proceed according to dependencies. Private leads/commissions require complete access control and abuse protection; Workers AI requires official capability/pricing checks and real bindings before integration.
4. Before future deployment, implement/verify staging configuration under F019 and run the existing checks. No approval has been requested for continuing ordinary implementation.

Useful commands: `npm ci`, `npx playwright install chromium`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:e2e`, `npm run test:production`, `npm run dev`.

F014 completed: Parametric concept library with editable dimensions and maturity. Species-specific horticultural growth models and photorealistic assets are not claimed.

F016 completed: Solar position is calculated with SunCalc 2.1.4 (degrees clockwise from north, converted to scene axes); source: https://github.com/mourner/suncalc . Four seasons and atmospheric presets are conceptual; shadows omit unknown neighboring heights and terrain.

F015 completed: Fence and hedge paths support editable dimensions, spacing, color and gate opening geometry. Designs are procedural concepts, not engineering/manufacturer specifications.

F025 completed: Multipart polygons and holes persist, render and participate in containment and area calculations. Total topology is bounded to 512 vertices; intersecting or touching hole boundaries are rejected.
