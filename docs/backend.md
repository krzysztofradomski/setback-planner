# Cloudflare backend and owner statistics

The planner works without any account. `worker/index.ts` serves `/api/*` and `/` (to add link previews); everything else comes from the ASSETS binding. Production and staging use separate EU-jurisdiction D1 databases.

## What the backend does

- **Public data and AI for visitors:** official registry layers (`/api/site-data`), surroundings (`/api/site-insights`), local plan reading (`/api/plan-pick`, `/api/pdf-text`, `/api/ocr-page`). AI calls are rate-limited per IP and capped globally; results are cached by content hash.
- **Link previews:** a share link carries the plot and building outlines in `?pv=` (decimetres), the house name in `pn` and the plot area in `pa`. For `/?pv=…` the worker rewrites the `og:` tags; `/api/og.png?pv=…` draws an 800×420 PNG (plot green, house orange). See `public/core/preview.ts`.
- **Funnel counts:** `POST /api/funnel {step, source}` adds one to a `(day, step, source)` row. Steps: visit, parcel, house (chosen by the visitor, not auto-placed), view3d, report, share, video. Source is the campaign label (`utm_campaign`, then `campaign`, `showroom`, `event`, `utm_source`, else `direct`). No IPs, identifiers or cookies are stored; rows older than 400 days are deleted by the daily cron.
- **Owner panel** (tab "Statystyki", shown with `?admin` in the URL or once signed in): sign-in, password change, the funnel table by campaign (7/30/90/365 days) and a campaign link + QR builder. A link may name a design with `dom=de-75|de-105|de-135|de-165`; it is placed when it fits.

## API

- Public: `GET /api/health`, `GET /api/og.png`, `POST /api/funnel`, `POST /api/auth/login`, `POST /api/auth/bootstrap`, `POST /api/auth/logout`, and the visitor data/AI routes above.
- Owner only: `GET /api/auth/me`, `POST /api/auth/password`, `GET /api/funnel?days=1..365`.
- Every non-GET request needs an exact same-origin `Origin` header.

Authentication uses salted PBKDF2-SHA256 (100,000 iterations), random 256-bit session tokens stored only as secret-peppered SHA-256 hashes, and Secure/HttpOnly/SameSite=Strict `__Host-` cookies with an eight-hour expiry. A password change ends all sessions. Only `owner` accounts can sign in; password recovery is done by whoever runs the infrastructure.

## Provision and deploy

1. `npm run build` and `npx tsc -p backend.config.json`.
2. Apply migrations: `npx wrangler d1 migrations apply setback-planner-production --remote` and `npx wrangler d1 migrations apply setback-planner-staging --remote --env staging`. Never edit an applied migration.
3. Secrets (at least 32 random characters, different per environment, fed through stdin): `SESSION_SECRET`, and `BOOTSTRAP_SECRET` only while creating the first owner. Rotating SESSION_SECRET signs everyone out.
4. Deploy staging (`npx wrangler deploy --env staging`), check `/api/health`, then production (`npx wrangler deploy --env ''`).
5. First owner: open `/?admin`, tab Statystyki → "Pierwsze konto właściciela", enter e-mail, a 12+ character password and the bootstrap secret (kept locally in the git-ignored `.dev.vars.bootstrap`). Then `npx wrangler secret delete BOOTSTRAP_SECRET --env ''` (and `--env staging`).

Migration 0003 (2026-11-28) wiped the test data (users, sessions, rate limits, funnel counts) and dropped the partner module tables (`tenants`, `leads`, `audit`, `ai_cache`); `users` now allows only the owner role. D1 Time Travel can still restore the earlier state for its retention window.

## Verification

`npm test` runs the worker against a real SQLite schema behind a D1-shaped adapter (owner sign-in, CSRF, password change, removed routes, funnel bounds and access) plus the preview encoder and PNG.
