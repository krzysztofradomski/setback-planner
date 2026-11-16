# Implementation status — 2026-11-16

The dependency-ordered backlog is implemented through F026, with F023 blocked on authoritative manufacturer drawings and asset reuse rights. `docs/features.json` records acceptance evidence and practical limits. The retained SVG editor, versioned scene, legacy links and local projects remain supported.

The planner includes generic/custom house footprints, attached structures, groups, locks, visibility, openings, architectural finishes and roof types; synchronized 3D/walk views; multipart parcels with holes; deterministic setbacks/suggestions; a parametric garden library; fences/gates/hedges; seasonal rendering and physical solar position; NMT terrain; attributed map overlays; variants, share links and printable reports.

Showroom integration isolates ordinary autosave and undo from visitors, warns before idle reset, clears visitor forms, and logs out privileged server sessions before kiosk entry. QR transfers include public scene data only. Campaign labels are first-party, unverified visitor claims.

Private business services use separate staging/production EU D1 databases, secure server sessions, scoped roles, explicit inquiry consent, Turnstile, audited retention/deletion, deterministic commission rules and CSV/API integration. No external CRM, email, webhook or pricing service is configured. No public recipient has been activated: the owner must supply the actual recipient/controller privacy disclosure and commercial rules.

Workers AI provides opt-in text extraction, citation-based summaries/report text, registered catalog metadata answers and layout proposals. Schemas and exact quotations are checked independently. AI never calculates placement feasibility or applies changes. Global/account daily quotas and 24-hour private caches limit processing; request limits are not a guaranteed monetary ceiling.

## Verification

Unit/integration tests run against deterministic fixtures and a real SQLite schema behind a D1 interface. Browser journeys cover editing, migrations, geometry, map outages, 3D resources, mobile layouts, reports and showroom isolation. Production smoke journeys verify built assets. Staging additionally passed real HTTPS owner authentication, D1 writes/reads and live Workers AI extraction and summary citation validation. Fresh final counts and deployment results are recorded in the release section below.

## Practical limitations and external blockers

- F023: published Udana Budowa model names are verified; precise dimensions, prices, heights, openings and licensed assets are unavailable. Catalog records preserve explicit unknowns. Generic examples are not manufacturer models.
- Official flood service capabilities returned HTTP 401. The app provides an official Hydroportal link. Planning/protected-area/utility rasters are context, not verified legal building lines or a complete network survey.
- Nine terrain samples and interpolated slopes are approximate. Datum, source capture dates and nearby building heights can be unknown. Shadows and conceptual materials are not engineering simulations.
- Concave pitched roofs use schematic flat caps. Openings and exterior details are conceptual. Walk mode has no collision simulation. Accent-area meshes, vehicle swept-path engineering and automatic vector building-line extraction are not supplied.
- Placement suggestions use a bounded deterministic sample grid and uniform user-selected setbacks; they are not exhaustive or legal feasibility decisions.
- Optional 3D/map bundles are lazy-loaded but exceed Vite's 500 KB chunk warning threshold. The ordinary 2D editor does not load them.
- Operational privacy notices, recipient activation and commission agreements require the actual platform owner's choices. No partnership is implied and no third-party message was sent.

## Operations

Production: https://setback-planner.paperplane.builders/ . Staging: https://setback-planner-staging.stronginarm.workers.dev/ . D1 schema migrations are applied independently. Secrets and first-owner credentials are outside Git in the owner's protected Codex private directory. Remove bootstrap secrets after owner creation. Cloudflare invocation/error logs and sampled traces are configured; use its dashboard for AI neurons and storage usage.

Rollback: use Cloudflare Worker deployment rollback to the previous version; retain the additive D1 schema and database backups. Do not reset or delete production databases when rolling back static/editor code.
