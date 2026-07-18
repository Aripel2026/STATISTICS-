# STAT 2.0

Bilingual (Hebrew/English, full RTL) web app comparing socioeconomic
indicators between Israel and European Union member states. Single-page
UI with two modes: **Verified comparisons** — a short list of indicators
pre-confirmed to use the same measure on both sides (currently inflation
and house prices, both as annual % change) — and **Browse all Eurostat
data**, a free-text search over Eurostat's full catalog where Israel data
can be manually attached (clearly marked as unverified). Pick which EU
countries/aggregate/Israel to show and view as a chart or table.

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
- **Israel CBS** (`apis.cbs.gov.il`) — actually **three separate CBS APIs**:
  - `index/*`: a dedicated, reliably-labeled price-index API (CPI, house
    prices, producer prices). Used by `cpi_inflation_yoy` and
    `housing_price_yoy` in `data/cbs-indicator-map.json` — each pairs a CBS
    year-over-year % change against a Eurostat series explicitly filtered
    to the matching "rate of change" unit, so the two are genuinely
    comparable, not just visually similar.
  - `SDMX/DATA/{agency}/{dataflowId}/{version}`: a public SDMX-ML gateway
    proxying IMF-standard-schema dataflows for Israel (`agency=IMF`),
    confirmed as genuine CBS data via the response's own `Sender id="ICBS"`
    header. Used by the `population` entry (`ECOFIN_POP`). See CLAUDE.md
    for the list of other confirmed-working dataflow IDs.
  - `series/*`: a general catalog, browsed hierarchically (`series/catalog/
    level`, `series/catalog/path`, `series/data/list`) since CBS has no
    free-text search. **Confirmed unreliable for automated concept
    matching** — a catalog leaf's own label can be flatly wrong for what
    it actually returns (see `CLAUDE.md`). Used only for the manual-attach
    flow: `/api/cbs/search` builds its own searchable index server-side
    (`server-lib/cbsIndex.ts`), and in "Browse all Eurostat data" mode the
    user can search it and attach a series themselves — clearly labeled
    "manually selected, not an automatic match" and plotted on its own
    chart axis, never presented as a verified pairing.

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
