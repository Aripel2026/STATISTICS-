# STAT 2.0

Bilingual (Hebrew/English, full RTL) web app comparing socioeconomic
indicators between Israel and European Union member states. Single-page
UI: search for an indicator, pick which EU countries/aggregate/Israel to
show, and view as a chart or table — no separate tabs to navigate.

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
  has no free-text search endpoint, so `/api/cbs/search` builds its own
  searchable index server-side by crawling CBS's categories
  (`server-lib/cbsIndex.ts`). `/data/cbs-indicator-map.json` is a curated,
  hand-confirmed mapping from a Eurostat dataset to a matching CBS series,
  auto-attached when present — see `scripts/discover-cbs.ts` for how
  candidates are found and verified before being added. **This map is
  intentionally empty right now**: CBS's own catalog leaf titles have been
  observed to be wrong for their underlying data (see `CLAUDE.md`), so
  automated keyword matching alone isn't trustworthy enough to ship. When
  no curated mapping exists, the UI lets the user search CBS themselves and
  attach a series manually — clearly labeled "manually selected, not an
  automatic match" and plotted on its own chart axis, never presented as a
  verified pairing.

## Development

```bash
npm install
npm run dev       # Vite dev server (frontend only)
npx vercel dev     # full stack: frontend + /api serverless functions
npm run build      # typecheck + production build
npm run verify     # live-call both APIs, report per-indicator readiness
```

`npm run verify` is the only source of truth for whether an indicator is
"ready" — it calls both live APIs and reports success/failure, last-updated
date, available year range, and whether Israel/EU data is present. No
indicator should be marked ready in the UI without a passing verify run.
It runs nightly in CI (`.github/workflows/verify.yml`) and on any PR
touching `server-lib/`, `scripts/`, or the CBS mapping file, with the
report uploaded as a build artifact so upstream API drift is caught
automatically rather than discovered by a user seeing stale/missing data.

## Deployment

Deployed on [Vercel](https://vercel.com) — `/api` routes are Vercel
Serverless Functions acting as a proxy (CORS, CBS User-Agent header,
response caching); the frontend is a static Vite build.

## Project structure

See `CLAUDE.md` for repo conventions and the architecture rationale.
