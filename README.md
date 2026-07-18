# STAT 2.0

Bilingual (Hebrew/English, full RTL) web app comparing socioeconomic
indicators between Israel and European Union member states.

## Core principle

**Never fabricate data.** If a value is unavailable from the source API, the
UI shows an explicit "No data available" message — never an estimate,
interpolation, or guess. Every chart displays a provenance footer with the
exact dataset/series code, source (Eurostat or Israel's CBS), and the
source API's own last-updated timestamp.

## Data sources

- **Eurostat** (`ec.europa.eu/eurostat/api`): EU member-state and EU
  aggregate data, JSON-stat format, no API key. Browsed dynamically via the
  Eurostat Table of Contents (`catalogue/toc/txt`).
- **Israel CBS** (`apis.cbs.gov.il`): Israeli data, browsed hierarchically
  (`series/catalog/level`, `series/catalog/path`, `series/data/list`) — CBS
  has no free-text search endpoint. See `/data/cbs-indicator-map.json` for
  the curated set of CBS series matched to Eurostat concepts, and
  `scripts/discover-cbs.ts` for how that map is populated and verified.

## Development

```bash
npm install
npm run dev       # Vite dev server
npm run build     # typecheck + production build
npm run verify    # live-call both APIs, report per-indicator readiness
```

`npm run verify` is the only source of truth for whether an indicator is
"ready" — it calls both live APIs and reports success/failure, last-updated
date, available year range, and whether Israel/EU data is present. No
indicator should be marked ready in the UI without a passing verify run.

## Deployment

Deployed on [Vercel](https://vercel.com) — `/api` routes are Vercel
Serverless Functions acting as a proxy (CORS, CBS User-Agent header,
response caching); the frontend is a static Vite build.

## Project structure

See `CLAUDE.md` for repo conventions and the architecture rationale.
