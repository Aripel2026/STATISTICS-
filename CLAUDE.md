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

**Important CBS catalog pitfall (confirmed live 2026-07-18): a catalog leaf's
own title can be wrong for its data.** E.g. `series/catalog/path` under
"Foreign Trade" listed leaf `95` as "Exports, Total" — but fetching it via
`series/data/list?id=95` reveals it's actually an *imports* sub-series
("Imports of Goods - Raw Material ... - for Agriculture"). Catalog
leaf-title keyword matching alone is **not sufficient** to confirm a
concept pairing; `discover-cbs.ts` requires the series's own fetched title
(`series/data/list`'s `name_id` field, ground truth) to also corroborate
the match before accepting it. Never add an entry to
`cbs-indicator-map.json` on catalog-title agreement alone — always check
what `series/data/list` actually returns.

**CBS's `series/data/list` is also intermittently flaky**: the same,
genuinely valid series ID (e.g. `120010`) can return 500 on one request and
200 on the next with no change in the request. `cbsClient.ts` retries
transient failures a couple of times before giving up; this is pure
reliability handling, it never changes what data is returned.

**Current state of `cbs-indicator-map.json`: intentionally empty.** A
keyword-matching discovery pass across all 34 CBS top-level categories
(5 pages each) found candidate catalog leaves for gdp/population/exports/
imports, but every one was rejected by the double-confirmation check above
— the actual fetched series turned out to be an unrelated country
breakdown or trade sub-category, not the headline concept the catalog
label implied. Shipping an empty map (Eurostat concepts show "not yet
mapped" for Israel) is the honest outcome here, not a shortfall to
work around with looser matching — see `scripts/discover-cbs.ts` to
retry with a human manually cross-checking CBS's own published
"Main Indicators" pages, which is the more reliable path forward.

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
