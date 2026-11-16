# Implementation status — 2026-11-16

The current workspace correction is tracked in F027. F023 now has verified main-building envelopes and public manufacturer photos/plans; detailed 3D geometry remains limited by unavailable height, pitch and elevation specifications. `docs/features.json` records acceptance evidence and practical limits. The retained SVG editor, versioned scene, legacy links and local projects remain supported.

The planner includes generic/custom house footprints, attached structures, groups, locks, visibility, openings, architectural finishes and roof types; synchronized 3D/walk views; multipart parcels with holes; deterministic setbacks/suggestions; a parametric garden library; fences/gates/hedges; seasonal rendering and physical solar position; NMT terrain; attributed map overlays; variants, share links and printable reports.

Showroom integration isolates ordinary autosave and undo from visitors, warns before idle reset, clears visitor forms, and logs out privileged server sessions before kiosk entry. QR transfers include public scene data only. Campaign labels are first-party, unverified visitor claims.

Private business services use separate staging/production EU D1 databases, secure server sessions, scoped roles, explicit inquiry consent, Turnstile, audited retention/deletion, deterministic commission rules and CSV/API integration. No external CRM, email, webhook or pricing service is configured. No public recipient has been activated: the owner must supply the actual recipient/controller privacy disclosure and commercial rules.

Workers AI provides opt-in text extraction, citation-based summaries/report text, registered catalog metadata answers and layout proposals. Schemas and exact quotations are checked independently. AI never calculates placement feasibility or applies changes. Global/account daily quotas and 24-hour private caches limit processing; request limits are not a guaranteed monetary ceiling.

## Verification

Unit/integration tests run against deterministic fixtures and a real SQLite schema behind a D1 interface. Browser journeys cover editing, migrations, geometry, map outages, 3D resources, mobile layouts, reports and showroom isolation. Production smoke journeys verify built assets. Staging additionally passed real HTTPS owner authentication, D1 writes/reads and live Workers AI extraction and summary citation validation. Fresh final counts and deployment results are recorded in the release section below.

## Practical limitations and external blockers

- F023: DE75/105/135/165 are placeable using exterior dimensions transcribed from public manufacturer plans. Photos and plans are bundled with attribution. Heights, pitch, overhangs and detailed elevations remain unknown; 3D uses illustrative defaults. Envelope dimensions exclude carports and terraces. Prices are not inferred.
- The public ISOK INSPIRE flood service used by Gruntometr is integrated, together with groundwater, relief, SOPO landslides, MIDAS mining/deposits and CBDH hydrogeological layers. Planning and risk rasters are context, not legal conclusions or a complete survey. Coverage and scale limits are disclosed.
- Nine terrain samples and interpolated slopes are approximate. Datum, source capture dates and nearby building heights can be unknown. Shadows and conceptual materials are not engineering simulations.
- Concave pitched roofs use schematic flat caps. Openings and exterior details are conceptual. Walk mode has no collision simulation. Accent-area meshes, vehicle swept-path engineering and automatic vector building-line extraction are not supplied.
- Placement suggestions use a bounded deterministic sample grid and uniform user-selected setbacks; they are not exhaustive or legal feasibility decisions.
- Optional 3D/map bundles are lazy-loaded but exceed Vite's 500 KB chunk warning threshold. The ordinary 2D editor does not load them.
- Operational privacy notices, recipient activation and commission agreements require the actual platform owner's choices. No partnership is implied and no third-party message was sent.

## Operations

Production: https://setback-planner.paperplane.builders/ . Staging: https://setback-planner-staging.stronginarm.workers.dev/ . D1 schema migrations are applied independently. Secrets and first-owner credentials are outside Git in the owner's protected Codex private directory. Remove bootstrap secrets after owner creation. Cloudflare invocation/error logs and sampled traces are configured; use its dashboard for AI neurons and storage usage.

Rollback: use Cloudflare Worker deployment rollback to the previous version; retain the additive D1 schema and database backups. Do not reset or delete production databases when rolling back static/editor code.

## Release verification

Application source `c367969` was fast-forwarded to `main`, pushed to origin and deployed to both environments on 2026-11-16. Production deployment initially returned version `54ec976f-1f2f-483c-9bde-4aa7ed7e24e2`; subsequent secret configuration creates newer Cloudflare versions without changing application source. Final staging application deployment: `93d9309c-5d1a-4b24-a832-8e5f1c4d8f52`.

Passed: 61 unit/integration tests, 31 Playwright browser journeys, 3 built-production smoke journeys, TypeScript checks, ESLint and npm audit (zero vulnerabilities). Vite emits the documented optional chunk-size warning. Live production checks confirmed editor add, rendered 3D, showroom logout/enter/exit, authenticated owner/D1 management and no uncaught browser exceptions. Both hosts return health 200 and anonymous private API 401; bootstrap returns 403 after temporary secrets were removed. Staging live Workers AI extraction and summary returned independently verified source citations. No public recipients were enabled and no messages were sent.

## Workspace correction

See `docs/ui-review-2026-11-16.md` for the layout audit, independent review findings and fixes. The public manufacturer gallery contained dimensioned plans that the previous research missed; those dimensions now drive placement. Manufacturer photos and plans are served from the dedicated Vite static directory and included in production browser journeys. The new public geospatial services were verified with actual GetMap images and CORS headers, using primary providers rather than Gruntometr APIs.

## Parcel-first flow (F028)

A live Gruntometr usability study informed a guided entry: address/full identifier/map/GPS → confirm official boundary → choose a house → review geometric issues and surrounding sources. Fresh examples are not autosaved before a choice. Existing projects and shared links retain direct entry. Address candidates are explicitly distinguished from properties, and preview/confirmation guards protect edits. See `docs/gruntometr-flow-study.md` and `docs/address-search.md` for observations, source contracts, limits and review evidence.

## Visual system and placement UX (2026-11-16)

- One stylesheet, `public/ui.css`, replaces `workspace.css` and `parcel-journey.css`. It uses one token set (spruce green, surveyor's yellow as the single marker colour, Archivo throughout) and nothing smaller than 12px. All the drawing colours are tokens too.
- The inspector column only appears when something is selected; otherwise the plan gets the width. The plan stays centred when panels open or close.
- Welcome screen: an animated site-plan drawing (boundary → setback → house → clearance), which respects `prefers-reduced-motion`.
- Confirming a parcel re-seats unlocked buildings into the free setback area (`fitItemsToParcel`). New houses and garages follow the parcel's longest edge (`parcelAxis`).
- The fence, terrain, environment and showroom controls show one language at a time (`data-bi="EN|PL"`, updated by `applyLang`). An empty fence path now means the whole parcel boundary.
- 3D: sky gradient, a surrounding meadow fading into horizon fog, ACES tone mapping, sharper shadows, and corner stakes at the boundary vertices.
