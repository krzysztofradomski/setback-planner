# Implementation status

Work branch: `codex/scene-foundation`. Feature order and acceptance criteria live in `features.json`; dependencies determine the next unblocked feature. No production deployment has been performed.

## Current work

F001 completed: inventory, build, lint, typecheck and three browser regressions passed. Existing SVG editor retained. Read `repository-audit.md` for architectural decisions and source checks.

## Resume

F002 completed: validated simple-ring geometry, explicit touching/overlap classification, concave containment, transform invariance. SVG checks use the shared module. Next: F003 canonical scene. Keep each completed feature in a separate reviewed/tested commit. Never mark an entire broad capability complete because only its foundation exists.

Dependency review: transitive minimatch override uses patched 11.x; npm audit reports zero vulnerabilities. Review: containment boundary behavior is explicit; touching buildings are flagged; no planning-law claims added.

F003 completed: strict v2 scene, atomic legacy migration, bounded decompression, full-state sharing, latest-edit clipboard sharing, and startup recovery without overwriting unsupported stored projects. Tests: 9 unit and 5 browser tests. Next: F004 project files, variants and full undo/redo.

F004 completed: JSON files, 20 named local variants, full-scene undo/redo, detached duplication, and settings recovery. Review covered storage failures, invalid imports, undo after import, ID regeneration and redo invalidation. 11 unit/6 browser tests pass; build/lint/typecheck pass. Next: F005 generic footprints.
