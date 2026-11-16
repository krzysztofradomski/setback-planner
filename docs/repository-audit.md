# Repository audit — 2026-11-16

Baseline: `04fc331` on main; clean worktree. Three source/config files and three documentation screenshots. No AGENTS.md applies. No existing package manager, React, TypeScript, tests, CI, server code, database, or authenticated services.

## Existing feature inventory

`public/index.html` contains the entire responsive EN/PL SVG editor: four editable parcel corners; rectangle creation; houses/garages; building naming, size, orientation, setback; duplication/deletion; pointer drag/resize; grid snapping; pan/zoom/pinch; keyboard controls; undo; boundary and pair measurements; coverage statistics; browser autosave; JSON import/export; compressed #z and uncompressed #p shared links. Cloudflare Static Assets hosts `public` on the configured custom domain.

## Findings

- There is no canonical versioned scene contract. Import silently drops unknown objects and fields; duplicate IDs are accepted; invalid/self-intersecting parcels are accepted.
- Pair intersection misses some collinear overlaps. Building containment checks corners only and can miss edges crossing a concave parcel. Numeric and decompression sizes are unbounded.
- Undo stores only plot/items; no redo. JSON export omits display options. Copy link can lag the latest edit. Async URL encoding can overwrite newer state.
- Four-corner assumptions occur throughout parcel UI, labels, centroids and geometry loops. Arbitrary parcel import requires deliberately removing these assumptions.
- Planning defaults are simplified conceptual distances. Current UI can imply legal success; legal compliance is not established by this tool.
- No geospatial sources, terrain, catalogs, manufacturer assets, materials, 3D, vegetation, environmental model, reports, AI, showroom, leads, permissions, or financial audit exist.
- No credentials or manufacturer drawings have been established. Do not infer dimensions or reuse copyrighted renders.

## Architecture decision

Preserve the SVG renderer and existing interactions. Extract its script without redesign; add typed, independently tested geometry and scene modules. A Vite build bundles local dependencies for Cloudflare Static Assets. Introducing React now would replace working code without a demonstrated benefit; reconsider for substantial new component trees. Both renderers must consume the same metric footprint function. Geometry must not depend on catalogs, rendering, or legal interpretations.

Keep local project storage and URL sharing free of contact information. Explicitly registered catalogs are inert data modules; unknown module references preserve fallback scene geometry. Unknown future scene versions fail without overwriting data.

## Source checks

Retrieved 2026-11-16: https://developers.cloudflare.com/workers/static-assets/ and https://developers.cloudflare.com/workers/platform/pricing/ . Static asset requests are free/unlimited; Workers Free dynamic requests have a daily allowance and CPU restrictions. Existing static hosting needs no new paid binding. No D1/R2/AI resource is provisioned here; review each product's current official limits before adding it.

https://udanabudowa.pl/ currently lists DE 75, DE 105, DE 135, DE 165. Its model cards and calculator show inconsistent price references; no price should be presented as a verified quote. Exact footprint dimensions, ridge/eaves heights and licensed assets have not been established. Catalog metadata can be implemented independently; exact model placement is blocked on authoritative drawings.
