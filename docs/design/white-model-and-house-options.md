# White Model landing film and Udana Budowa options

The landing page enhances the original SVG/CSS animation in place: the parcel plan draws, tilts into an architectural model, and the house rises. An adjacent open carport, chimney, ventilation terminal, PV array and heat pump reveal in sequence with an orange highlight, then settle into matte white. The original dimensional guides, parcel corners, fit badge, and gentle model sway remain part of the landing illustration.

There is no media player, canvas overlay, timeline, sound toggle, or separate title card. Reduced motion shows the completed native illustration. It works without WebGL and scales with the existing landing layout.

The earlier storyboard at `/design/white-model/` remains a design reference; its STAGE kit is the verbatim user-supplied reference. Production uses the original landing animation, with White Model materials and orange extras applied directly to its SVG/CSS elements. The interactive house viewer continues to use Three.js.

For a selected Udana Budowa house, **Opcje domu / House options** exposes:

- Parking: none, carport or garage. The actual grouped annex is a separate scene object, including its clearance footprint. Switching removes the previous managed annex and respects locked objects and the 100-object limit.
- Fireplace, heat recovery ventilation, solar panels and heat pump: saved `houseOptions` flags. Old projects without flags retain the catalogue rendering defaults.
- Top view removes the roof and exposes the fireplace and ventilation ducts. Outside, the roof terminal, louvres and heat pump make the installations visible.

`attachedTo` records annex ownership. Legacy catalogue groups with one parking annex remain editable. Duplicating a house also copies its managed annex into an independent group; deleting the house removes its managed annex.

Source: https://udanabudowa.pl/ (configuration checked 2026-11-22). It lists wiata, kominek, rekuperacja, fotowoltaika and pompa ciepła. Garage is the additional variant requested by the user, with dimensions adapted from the existing annex metadata. Equipment, locations, garage dimensions, roof height and pitch are illustrative, not an installation specification. Existing plan-derived house and carport dimensions remain attributed in the catalogue.

Validation: `npm test`, `npm run typecheck`, `npm run build`; browser regressions in `tests/browser/house-options.spec.ts`, plus the existing viewer and workspace suites. The development server must serve this repository; the default test configuration uses port 5173.

## Production split — 2026-11-23

- Current planner: `https://ub.radomski.dev/`, existing Worker `setback-planner`, version `2a3f3cc5-b21d-4720-b11b-d1cc657d3ca1`. Existing production D1/AI/session/Turnstile bindings retained; no pending migrations. Turnstile now also permits `ub.radomski.dev`.
- Legacy 2D planner (now only on the `legacy` branch): `https://setback-planner.paperplane.builders/`, independent static Worker `setback-planner-classic`, version `04767de9-9541-4eb3-b03d-ff553bd7ad9c`. Live HTML matches the archived `04fc331` source exactly.
- Previous current-planner version available for rollback: `ed034e10-ccd9-43a2-93c6-3ccb0808633c` (rolling code back does not restore or alter database data).
