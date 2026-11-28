# Setback Planner

**Current planner:** [ub.radomski.dev](https://ub.radomski.dev).

**Legacy 2D planner** (setback-planner.paperplane.builders, Worker `setback-planner-classic`) lives only on the `legacy` branch; it is not part of `main`.

A bilingual parcel and house concept planner. The existing SVG editor is retained, with typed domain modules and optional Three.js and MapLibre views.

- Local metric editing, arbitrary simple parcel boundaries, buildings, rotation, resizing, snapping, clearances, collisions, touch pan/zoom and keyboard controls.
- Generic rectangular, L, T and U house footprints, wing proportions, storeys, wall height and roof settings.
- Conceptual architectural finishes, including brick slips, per-wall overrides, grout, physical texture scale and reset/comparison controls.
- Optional lazy 3D massing view with orbit/top/axonometric cameras, approximate shadows, screenshots and low-power mode.
- GUGiK ULDK parcel lookup by identifier or explicit map selection. GeoJSON import in WGS84 or PL-1992. Provenance and locally edited boundary labels.
- Optional attributed street, orthophoto and cadastral map layers. Provider failures preserve the editor.
- Versioned projects, legacy `#p` / `#z` link migration, full-state sharing, browser autosave, undo/redo, 20 local variants and JSON files.
- SVG export and printable EN/PL reports with browser PDF saving and explicit unknown requirements.
- Placeable Udana Budowa DE75/105/135/165 envelopes measured from dimensioned manufacturer plans, public photos, zoomable floor plans and source attribution. Heights/pitch remain illustrative; prices are not inferred.
- Parcel-first address/identifier/map search, boundary confirmation, house choice and layout review; returning projects open directly.
- Reviewed desktop library/canvas/inspector workspace, dismissible mobile sheets and English/Polish navigation.

Setbacks are user-selected geometric inputs (defaults: 4 m for houses, 3 m for garages). This tool does not establish legal or technical building feasibility. Multipart parcels and holes are supported. Terrain, planning/utility/protected-area/flood/groundwater/geology overlays, garden objects, fences, seasons, link previews, campaign statistics and source-based Workers AI are implemented. See the status document for explicit external blockers and practical limits.

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

Cloudflare Worker Static Assets serves `dist` after the build. The existing custom domain configuration is preserved. Separate staging/production D1 databases, Workers AI and owner sign-in for the statistics panel are configured. R2 is unnecessary because no binary upload service is provided.

```bash
npm run build
npx wrangler deploy
```

Staging uses `npx wrangler deploy --env staging`; production uses `--env ''`. See [backend operations](docs/backend.md) for migrations, secrets, link previews and the statistics panel. For local API development, run `npm run dev:worker` alongside Vite and apply local D1 migrations; Vite proxies `/api` to port 8787. Never commit `.dev.vars` files.

## Separate deployments

The current planner uses `wrangler.jsonc` and the existing `setback-planner` Worker, API bindings, database and secrets, served at `ub.radomski.dev`. Build with `npm run build`, then deploy with `npx wrangler deploy --env ''`.

The legacy standalone 2D planner was moved to the `legacy` branch (`classic/index.html`, `wrangler.classic.jsonc`). Deploy it only from that branch with `npx wrangler deploy --config wrangler.classic.jsonc`. Despite its name, the `setback-planner` Worker and the `setback-planner-*` D1 databases belong to the current planner at ub.radomski.dev.
