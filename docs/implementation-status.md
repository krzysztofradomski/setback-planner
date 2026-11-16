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
