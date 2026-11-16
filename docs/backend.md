# Cloudflare backend and private business module

The planner remains usable without accounts or active recipients. `worker/index.ts` serves only `/api/*`; all other requests go to the ASSETS binding. D1 production and staging use separate EU-jurisdiction databases. No manufacturer partnership is implied and no external messages are sent.

## Provision and deploy

1. `npm run build` and `npx tsc -p backend.config.json`.
2. Apply `npx wrangler d1 migrations apply DB --remote --env ''` and separately `--env staging`. Migration 0001 creates the schema; do not delete or rewrite an applied migration.
3. Provision independent random secrets of at least 32 characters with `wrangler secret put SESSION_SECRET --env ''` and `wrangler secret put BOOTSTRAP_SECRET --env ''`, repeating with different values for staging. Feed secrets through stdin from protected local files; do not put them in command arguments or committed files. SESSION_SECRET rotation invalidates existing sessions.
4. Deploy staging with `npx wrangler deploy --env staging`, check `/api/health`, then production with `--env ''`.
5. Open “Zapytania i prywatny panel partnerów”. Create the first owner with the bootstrap secret, email and password (minimum 12 characters), then remove BOOTSTRAP_SECRET from the deployed worker. A database uniqueness constraint prevents a second owner even during a race. Create named independent tenants and users in that panel.
6. Public inquiries remain **disabled** until both TURNSTILE_SITEKEY (public variable) and TURNSTILE_SECRET_KEY (secret) exist and the owner explicitly enables a tenant with a privacy notice naming the actual controller, contact, purpose and retention. Register production and staging hostnames in the Turnstile widget. The widget uses action `inquiry`; the server verifies success, hostname and action with Siteverify. A token cannot substitute for visitor processing consent. Marketing consent is separate and optional.

Configured cron runs daily. Personal contact, scene, attribution, consent and email digest are erased after each tenant's configured retention. Each cron atomically audits and erases all expired leads using bulk SQL; session/rate/cache records expire and are purged. AI results expire after 24 hours and are purged by cron. D1 Time Travel backups follow Cloudflare's retention separately; erasure is not a claim of instant backup removal. Immutable audit retains pseudonymous IDs, configuration and financial references; use non-personal contract/payment references, never names/contact data. Infrastructure owners must choose audit retention appropriate to their obligations; there is no automatic financial-audit deletion.

## UI integration

```ts
import { mountBusiness } from './business.ts';
const business = mountBusiness({ container, getScene, getAttribution });
// Before entering a public kiosk: await business.logout(); hide container.
// Between visitors: business.clearPersonalData();
```

`getAttribution` accepts bounded UTM/source/campaign/manufacturer/showroom/event/representative keys with firstSeenAt and lastSeenAt (ISO or epoch milliseconds). It uses explicit first-party data only. Attribution is visitor supplied, unverified marketing metadata; financial confirmation remains manual. `shareUrl` is accepted for host compatibility but never persisted; private contact, leads and commissions never enter public scenes or URLs.

Authentication uses salted PBKDF2-SHA256 (100,000 iterations, Workers WebCrypto ceiling), random 256-bit session tokens stored only as secret-peppered SHA256 hashes, Secure/HttpOnly/SameSite=Strict `__Host-` cookies with eight-hour expiry. All mutations require an exact same-origin Origin header. Password change revokes all sessions. Owner may add/deactivate scoped users; manufacturer role manages its tenant's leads; sales role reads its tenant's leads and reports only. Owner can access all tenants. Admin UI is a separate detail panel; host must terminate sessions and hide it on public kiosk devices. Password recovery is an infrastructure-owner operation, not an unauthenticated email flow.

## API

JSON requests are capped at 128 KiB; scenes at 65,000 characters. Schemas reject extra fields. API responses disable caching, do not return internal exceptions and do not allow cross-origin access.

- `GET /api/health`, `GET /api/recipients` (only enabled recipient names/notices and public sitekey).
- `POST /api/auth/bootstrap`, `/api/auth/login`; `GET /api/auth/me`; `POST /api/auth/logout` (idempotent, also for kiosk reset); `POST /api/auth/password` with currentPassword/newPassword.
- Owner: `GET/POST /api/tenants`, `PATCH /api/tenants/:id` (recipient configuration, privacy notice, retention, commission rules); `GET/POST /api/users`, `PATCH /api/users/:id` with active flag.
- Public `POST /api/inquiries`: selected tenantId, projectId, contact, opaque scene/project, attribution, explicit processingConsent, separate marketingConsent, exact current privacyNotice, Turnstile token. No legal or geometry interpretation of scene. Ordinary planning does not create contacts. No email/webhook delivery is attempted; recipient reviews standalone private inbox.
- Authenticated `GET /api/leads?tenant=…`, `/api/leads.csv?tenant=…`, `/api/report?tenant=…`, `/api/audit?tenant=…` (latest 1,000 records); scope checked on server. CSV is escaped against spreadsheet formula injection. Report groups status, source and currency, current contract conversion and eligible/settled amounts; currencies are never combined.
- Manufacturer/owner `PATCH /api/leads/:id`: status, evidence, existingCustomer, revision. Compare-and-swap revision with atomic D1 batch prevents stale updates and ties audit to successful writes. `DELETE /api/leads/:id` anonymizes PII while keeping financial state/audit.
- `POST /api/ai/extract`: authenticated tenantId, text, source, consent=true. See below.

## Deterministic commission policy

Owner configuration: agreement reference, attributionDays, excludeExisting, excludeDuplicates, requirePayment, optional campaign ownership, currency, mode `fixed` (minor units) or `basis_points` (integer 1/100%). Empty agreement/zero amount disables commission eligibility. Fixed amounts and basis points are owner supplied, never manufacturer-derived or hardcoded.

Normal status sequence: new → qualified → accepted → contracted → paid → commission_eligible → commission_settled. Rejection, cancellation, reversal and requalification paths are explicit. Contracted/paid/eligible/settled require contract reference and integer contract value. Paid requires first-payment reference. Eligibility applies agreement exclusions, campaign, original attribution window and optional payment requirement; disputes need a resolution reference. Settlement needs a settlement reference and unchanged confirmed contract/payment. Financial rules are snapshotted at eligibility so later policy changes do not rewrite settled amounts. Percentage arithmetic uses BigInt, rounded half up in integer minor units. Cancellation/reversal requires explanation and zeroes the current commission; prior amounts remain in audit. A planner visit alone cannot trigger eligibility.

Duplicate email checks are scoped to a recipient; an atomic SQL existence check flags subsequent submissions. Campaign and visitor timestamps are untrusted claims requiring partner verification. Manual corrections (including disputed attribution) proceed through audited rejection/requalification and explicit owner policy, with no autonomous financial side effects. There is no configured CRM adapter or delivery promise; CSV and private API are the standalone integration boundary.

## AI privacy, validation, cost and limits

AI_ENABLED=true enables authenticated processing only. Users explicitly opt in before sending document text to Workers AI. The service caps input at 24,000 characters, max output at 1,800 tokens, global new processing at AI_DAILY_LIMIT (20 production, 10 staging) per UTC day and 10 per account/day. Counters are atomic D1 rows; failed upstream attempts consume budget. These limits bound requests, **not a guaranteed dollar/neuron budget**; monitor the Cloudflare AI dashboard. No anonymous AI endpoint exists.

Model `@cf/meta/llama-3.3-70b-instruct-fp8-fast` supports JSON schema output. Zod independently validates the result; each extracted value must occur inside its exact quote, which must occur in supplied text. All claims are marked uncertain and require human review. Wrong-format/uncited responses fail safely. Repeated input/source is cached privately by tenant for 24 hours; document text is not separately stored, though output quotes necessarily retain excerpts. No PDF binary OCR, legal conclusions, geometry calculations, autonomous scene edits or factual correctness guarantees are implied. Prompt instructions treat document content as untrusted; output never executes tools or changes planning rules.

Official documentation reviewed 2026-11-16:

- [Workers AI binding](https://developers.cloudflare.com/workers-ai/configuration/bindings/) and [JSON Mode supported models/schema](https://developers.cloudflare.com/workers-ai/features/json-mode/).
- [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/): 10,000 free neurons/day, $0.011/1,000 neurons above allowance on Paid; usage depends on model. [AI limits](https://developers.cloudflare.com/workers-ai/platform/limits/) may reject upstream calls independently of local budgets.
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): Free 5m reads/day, 100k writes/day, 5 GB total. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/): Free DB 500 MB, Paid 10 GB; 50/1,000 queries per invocation; 100 bound parameters/query. Tenant indexes and bounded results avoid unbounded request scans. Daily housekeeping and D1 rate counters also consume writes.
- [Workers pricing/CPU limits](https://developers.cloudflare.com/workers/platform/pricing/); assets and API requests have different billing behavior.
- [Turnstile server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/): short-lived single-use tokens; success alone is insufficient without matching action/hostname.

Worker observability records invocation metadata/errors and sampled traces. Application error logs include route and error class only, not document text, credentials or contact. Cloudflare dashboards remain the source of infrastructure storage and AI neuron usage.

## Verification

`node --experimental-strip-types --test tests/backend.test.ts` runs an actual SQLite schema behind a D1-shaped adapter and tests owner/session/CSRF, two-tenant isolation, role enforcement, immutable audit, public recipient/consent/challenge validation, duplicate detection, private AI cache and quotas, quote rejection, optimistic status conflicts, deterministic eligibility, snapshotted settlement, CSV hardening and PII erasure. `npx tsc -p backend.config.json`, lint, build and Wrangler dry-run check integration. Real Turnstile and live inference require configured user access and are not simulated as production success.

## Additional assistant modes

`POST /api/ai/assist` accepts tenantId, consent=true, mode and question. Summary/report modes accept bounded text sources (id/title/text and optional HTTPS URL/retrieval timestamp) and return only independently checked verbatim excerpts. Catalog mode accepts registered catalogIds and uses trusted server metadata. Layout mode accepts a minimal metric scene and returns bounded proposed operations referencing existing unlocked IDs and explicit numeric instruction excerpts. Nothing is applied automatically. Modes share extraction quotas and tenant cache isolation. Generic source text is untrusted and does not become a verified official restriction.

Production and staging Turnstile hostname registration and secret bindings were provisioned. First-owner credentials are stored outside the repository in the owner's protected Codex private directory. Bootstrap secrets are removed after initialization. No public recipient was enabled.
