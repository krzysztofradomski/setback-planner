# Optional showroom and campaign attribution

The independent `public/showroom.ts` module mounts a presentation setup disclosure. Nothing changes the current scene until the operator explicitly starts the presentation. Profiles consist of optional public profile/manufacturer/event/campaign labels; no manufacturer catalog or contact form is required. The live module exports no admin credentials and does not persist profile setup.

```ts
import { mountShowroom } from './showroom.ts';
const showroom = mountShowroom({
  container: document.querySelector('#showroom')!,
  getScene: () => scene,
  applyScene: next => replaceScene(next),
  shareUrl: () => createFullProjectShareUrl(), // sync or async
  setView: view => changeView(view),
  onActiveChange: active => suspendOrdinaryAutosave(active),
  onSessionReset: () => clearVisitorInquiryAndUndoHistory(),
  idleSeconds: 180,
  warningSeconds: 20,
});
const campaign = showroom.getAttribution(); // nullable, detached object for inquiry API
```

`getScene` and `applyScene` use the existing validated `Scene` type. The module saves the original scene in memory and restores it on exit. `onActiveChange(true)` runs before any demo mutation; `onActiveChange(false)` runs after restoring the original scene. The host must suspend ordinary autosave and keep the ordinary undo/selection context separate while showroom is active, and restore that context when leaving. Host inquiry forms, temporary export URLs, visitor selection and visitor undo history must be cleared in `onSessionReset`. That callback runs at entry, each reset and exit. `enter()`, `exit()`, `reset()`, `isActive()`, `getAttribution()` and `destroy()` are returned.

Only keys beginning with `setback-planner:kiosk:` are removed from localStorage/sessionStorage on reset and exit; ordinary projects/variants and campaign attribution are preserved. No contact details are collected by this module. Integrations should store any kiosk drafts/contact data only in the kiosk namespace, never in ordinary project storage. Reset creates a fresh generic example and returns to the attract screen. Before inactivity reset, an accessible modal warning permits continuation; pointer/key activity cannot accidentally dismiss that warning. The attract dialog traps focus and lets Escape start planning. Idle duration is bounded to 30–1800 seconds, warning to 10–60 seconds and always shorter than idle. Timer stops on the attract screen. Fullscreen is a user gesture and falls back to normal layout when the browser rejects it. All controls support keyboard input, large touch targets and reduced motion.

The guided demo presents generic editable home, garden and 3D steps. QR transfer asks the host for a full project hash (`#p=`, `#s=` or `#z=`), restricts it to the current origin and removes all query parameters. Generated links contain project state, never contact/profile/attribution fields. QR generation errors leave a readable recovery message; asynchronous QR results are discarded after reset or exit. The host should produce its ordinary share link with an optional configured public base origin if deployment redirects are used; cross-origin transfer is intentionally refused.

Campaign attribution is first-party, with an in-memory fallback when sessionStorage is unavailable. The key is `setback-planner:attribution:v1`. The returned shape is a partial string map of `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `manufacturer`, `showroom`, `event`, `campaign`, `representative`, plus ISO `firstSeenAt` and `lastSeenAt`. New valid campaign labels merge with the tab's preceding attribution; unknown fields are discarded. Labels accept up to 80 Unicode letters/numbers, spaces, periods, underscores and hyphens. Email addresses, URLs, markup and control characters are rejected. No full URL/referrer, third-party cookies, network tracking requests, or device/fingerprint IDs are recorded. Attribution timestamps describe the first and latest valid campaign touch within this tab, not an identity. The backend must independently validate inquiry attribution.

Verification: `node --experimental-strip-types --test tests/showroom.test.ts` checks validation, timestamp merge, timer bounds, namespace isolation, generic scenes and private query stripping. `npx playwright test --config showroom.playwright.config.ts` uses a disposable intercepted HTML fixture and Vite on port 5175 to check complete demo/QR/exit and inactivity warning/continuation/reset. It requires no deployed fixture or app edits. Browser tests also run with the project's ordinary Playwright configuration.
