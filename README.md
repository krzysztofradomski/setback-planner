# Setback Planner

**Production:** [setback-planner.paperplane.builders](https://setback-planner.paperplane.builders). The development work on `codex/scene-foundation` has not been deployed.

A bilingual parcel and house concept planner. The existing SVG editor is retained, with typed domain modules and optional Three.js and MapLibre views.

- Local metric editing, arbitrary simple parcel boundaries, buildings, rotation, resizing, snapping, clearances, collisions, touch pan/zoom and keyboard controls.
- Generic rectangular, L, T and U house footprints, wing proportions, storeys, wall height and roof settings.
- Conceptual architectural finishes, including brick slips, per-wall overrides, grout, physical texture scale and reset/comparison controls.
- Optional lazy 3D massing view with orbit/top/axonometric cameras, approximate shadows, screenshots and low-power mode.
- GUGiK ULDK parcel lookup by identifier or explicit map selection. GeoJSON import in WGS84 or PL-1992. Provenance and locally edited boundary labels.
- Optional attributed street, orthophoto and cadastral map layers. Provider failures preserve the editor.
- Versioned projects, legacy `#p` / `#z` link migration, full-state sharing, browser autosave, undo/redo, 20 local variants and JSON files.
- SVG export and printable EN/PL reports with browser PDF saving and explicit unknown requirements.
- Optional manufacturer catalog metadata. Current Udana Budowa model entries have no inferred dimensions, prices or reused renders.

Setbacks are user-selected geometric inputs (defaults: 4 m for houses, 3 m for garages). This tool does not establish legal or technical building feasibility. Holes and separate parcel components are currently rejected explicitly. Terrain, planning/risk overlays, landscaping, seasons, Workers AI, showroom and private lead management remain in the backlog.

## Development

Node 22.18+ is required. New domain modules use TypeScript; the existing SVG controller remains JavaScript.

```bash
npm ci
npx playwright install chromium
npm run dev
```

```bash
npm test
npm run typecheck
npm run lint
npm run test:e2e
npm run test:production
```

`test:production` builds the site and runs map/worker, 3D and report smoke journeys against Vite preview. Full development browser tests also cover service outages, imports, storage recovery, mobile controls and GPU resource stability. External services are mocked in automated browser tests; official ULDK response fixtures were captured separately.

[Feature backlog](docs/features.json) · [Current status and handoff](docs/implementation-status.md) · [Repository audit](docs/repository-audit.md) · [Geospatial contracts and sources](docs/geospatial-sources.md)

## Build and deployment

```bash
npm run build
npm run preview
```

Cloudflare Worker Static Assets serves `dist` after the build. The existing custom domain configuration is preserved. No D1, R2, AI binding, credentials or new Cloudflare resources have been provisioned.

```bash
npm run build
npx wrangler deploy
```

Separate staging and backend observability remain in F019; production deployment has not been performed during this implementation.
