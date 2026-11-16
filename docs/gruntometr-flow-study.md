# Gruntometr usability study and adapted planning flow

Observed 2026-11-16 in live Chromium at desktop and phone widths. Source: [Gruntometr homepage](https://gruntometr.pl/), [public example report](https://gruntometr.pl/przykladowy-raport), and [field mode](https://gruntometr.pl/w-terenie). We studied the public interface and public searches; no private API integration, account, purchase or contact submission was used.

## Observed flow

1. The homepage leads with an address/place, parcel/precinct, or listing-link input. Contextual labels, concrete clickable examples and a public sample report explain the task before visitors need cadastral terminology.
2. Search has a named localization state rather than immediately claiming an analysis. The tested public example took roughly 35 seconds to resolve; this was one observation, not a performance benchmark.
3. The next view identifies the parcel, administrative context, area and official boundary on satellite imagery. It asks whether this is the right parcel. Visitors can choose a neighboring parcel or search again before starting the report.
4. A local parcel number alone produces an ambiguity message with useful formats instead of silently choosing a property.
5. The public report prioritizes headline findings, then detailed maps and source sections. Its geometric envelope card connects area, dimensions, a diagram, assumptions and a house-design action.
6. Mobile keeps the search input/action prominent, offers explicit optional location access, and collapses report navigation into a compact section selector.

The current site describes the full report as free without an account, with optional support. We opened the public sample report; we did not run its report-generation pipeline or validate its risk, valuation or legal conclusions. Its long marketing lead-in and tall report identity section are not useful patterns to reproduce in the planner.

## Adapted flow

**Find parcel → confirm boundary → choose house → review layout.**

- Fresh visitors see a focused start screen with address/place search, complete cadastral identifier, map selection and optional GPS. They can explicitly explore the existing example instead. Unchosen examples are not automatically saved or shared.
- Address search uses the official [GUGiK UUG service](https://services.gugik.gov.pl/uug/opis.html), on submit only. Ambiguous places retain administrative labels. A location candidate is a map pin, never a confirmed property.
- Map selection resolves through ULDK and previews a detached boundary with area and source. Confirmation replaces the parcel only after an explicit action. The search form is replaced by a compact confirmation card so the primary action stays visible on phones. The user can click a neighboring parcel to correct it.
- Existing projects are preserved until confirmation. Late responses and edits made after preview invalidate confirmation instead of overwriting work. Returning projects and shared URLs bypass first-visit setup. A fresh confirmed parcel starts without the example buildings.
- After confirmation, the house catalog is the next action. Mobile Inspector includes a next-step review action. Direct Project navigation opens the same review.
- Review starts with geometric issues, object names and reasons, parcel/footprint metrics, and the region inside the user-selected edge offset. That region does not subtract obstacles or establish legal buildability. Issue actions return to the affected object on the plan.
- Thematic actions open planning, water, utilities, nature and ground-condition maps as tasks, while raw coordinates/import tools are secondary advanced options. Viewing a layer never becomes a verified “no risk” result.

We did not replicate listing scraping, automated valuation, legal scoring, account gates or a multi-register analysis engine. The adapted flow connects capabilities the planner actually has.

## Verification and review

Automated journeys exercise fresh entry, submit-only requests, ambiguous addresses, identifier preview/confirmation, neighboring correction, mobile primary-action visibility, GPS denial, project-change guards, saved/shared recovery and progression into house selection/review. Existing editor journeys use an explicit example-workspace fixture; new first-visit journeys run without it.

An independent browser review found and verified fixes for confirmation below the fold, the missing mobile next step, and Project navigation bypassing review. Focused checks at 320, 390 and 1440 px reported no remaining high/medium issue in that scope. Live (unmocked) UUG address search and ULDK parcel identification were also observed; no parcel was applied in that investigation. Public service availability and map tile coverage remain external dependencies.

Final local validation: 71 unit/integration tests, 51 full browser journeys and 12 production-build smoke journeys passed, with TypeScript and ESLint checks. The last regression reproduces and fixes canvas cropping when leaving the full-width introduction for the narrower editor. Existing optional map/3D chunk-size warnings remain documented.

Live preview inspection also exposed a pre-existing SVG visibility bug: setting a JavaScript `hidden` property did not hide the SVG drawing sheet. View switching now toggles the actual attribute, and map/3D regressions assert that the 2D drawing is invisible. This prevents the local example drawing from appearing behind a parcel map preview.
