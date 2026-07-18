# STAT 2.0 — repo conventions

## Non-negotiable rules

1. Never fabricate, estimate, or interpolate data. Missing values are
   `null` end-to-end (`SeriesPoint.value: number | null`) and render as an
   explicit "No data available" component (`NoDataNotice`) — never 0, never
   a blank cell, never `spanGaps: true` on charts.
2. Every chart shows a `ProvenanceFooter`: dataset/series code, source
   (Eurostat vs CBS), the source API's own `updated` timestamp (never
   "now"), and the raw API URL used.
3. Before using any new API endpoint, verify it against live docs/a live
   call — don't assume based on what seems logical. See `src/App.tsx`
   comments / plan history for endpoints already confirmed vs. still wrong
   in older notes (e.g. CBS paths need a `series/` prefix; there is no
   Eurostat JSON TOC, only txt/xml).
4. `npm run verify` gates which indicators the UI is allowed to mark ready.
   Don't hardcode a dataset/series as "known good" without a passing verify
   run backing it.

## Data flow

Eurostat catalog is fully dynamic (parsed from the TOC txt file, no
hardcoded indicator list). CBS has no search API and its catalog tree is
unreliable for concept-targeting (browsing "Labour" surfaces unrelated
series), so Israeli data uses two tracks:

- `CbsBrowser`: dynamic leaf-series browsing across all CBS top-level
  categories, showing CBS's own titles verbatim — standalone, not paired to
  a Eurostat concept.
- `data/cbs-indicator-map.json`: a curated, verify-gated mapping from
  Eurostat dataset code to a hand-confirmed CBS series ID, used to pair
  Israel data into IL-vs-EU comparisons. Populated/extended via
  `scripts/discover-cbs.ts`.

## Layout

- `/src` — Vite React frontend.
- `/api` — Vercel serverless functions (the proxy layer: CORS, CBS
  User-Agent header, response caching).
- `/server-lib` — shared Node code used only by `/api`, not shipped to the
  browser.
- `/data` — `cbs-indicator-map.json` (curated mapping), `toc-snapshot.json`
  (pre-parsed Eurostat TOC).
- `/scripts` — `verify.ts` (mandatory readiness gate), `discover-cbs.ts`
  (CBS catalog crawler + concept-matching helper).
