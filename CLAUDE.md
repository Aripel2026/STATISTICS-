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

## UI architecture: one page, not three

The app is a single page (`Dashboard.tsx`), not separate catalog/CBS/compare
tabs. Flow: `IndicatorSearch` (client-side substring search over the
flattened Eurostat TOC, with a "browse by category" fallback using
`CatalogTree`) → `CountrySelector` (multi-select EU member states + EU
aggregate + Israel toggle, all shown simultaneously) → `IndicatorChart` /
`MapView` toggle. Selecting several countries overlays them all on one
chart rather than requiring a single/aggregate/all-27 mode switch.

## Data flow

Eurostat catalog is fully dynamic (parsed from the TOC txt file, no
hardcoded indicator list). CBS has no search API and its catalog tree is
unreliable for concept-targeting (browsing "Labour" surfaces unrelated
series), so Israeli data uses two tracks:

- `data/cbs-indicator-map.json`: a curated, verify-gated mapping from
  Eurostat dataset code to a hand-confirmed CBS series ID, auto-attached
  when it exists. Populated/extended via `scripts/discover-cbs.ts`.
- **Manual attach (`CbsSeriesPicker`)**: when no curated mapping exists
  (currently always, see below), the user searches a server-built CBS
  series index (`server-lib/cbsIndex.ts`, `/api/cbs/search`) and picks a
  series themselves. This is explicitly labeled "manually selected — not
  an automatic match" in the UI (`cbsPicker.manual`) and gets its own
  secondary chart axis (`ChartSeries.secondaryAxis`) since its unit/scale
  isn't guaranteed comparable to the EU series — never silently plotted as
  if it were a verified pairing.

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

## Vercel deployment gotcha: relative imports need explicit `.js`

`/api/*.ts` files import shared code from `/server-lib/*.ts` (e.g.
`from "../../server-lib/cbsClient.js"`). **The `.js` extension is
required**, even though the source file is `cbsClient.ts` — this bit us
in production (confirmed live 2026-07-18): Vercel deploys each function
as a separate file rather than bundling `/server-lib` into it, and Node's
native ESM loader (this repo has `"type": "module"` in `package.json`)
does not do CommonJS-style extension-less resolution. Without `.js`, the
deployed function crashes at import time with
`ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/server-lib/...'` —
shown to the user as a generic Vercel `FUNCTION_INVOCATION_FAILED` page,
not one of our own error responses (the crash happens before our
try/catch even runs). TypeScript's `bundler`/`nodenext` resolution both
correctly map a `./foo.js` specifier back to `./foo.ts` at compile time,
so this costs nothing locally — it only breaks in the deployed
environment, which is why it wasn't caught until a real deploy. Any new
relative import between `/api`, `/server-lib`, or `/scripts` must include
the `.js` extension.

## Layout

- `/src` — Vite React frontend.
- `/api` — Vercel serverless functions (the proxy layer: CORS, CBS
  User-Agent header, response caching).
- `/server-lib` — shared Node code used only by `/api`, not shipped to the
  browser.
- `/data` — `cbs-indicator-map.json` (curated mapping), `toc-snapshot.json`
  (pre-parsed Eurostat TOC).
- `server-lib/cbsIndex.ts` — crawls all CBS top-level categories (1 page
  each) into a cached, searchable index backing `/api/cbs/search`, used by
  the manual CBS-attach picker. Cache TTL 6h; first request after a cold
  start pays the full crawl cost (`vercel.json` gives this route a longer
  `maxDuration`).
- `/scripts` — `verify.ts` (mandatory readiness gate), `discover-cbs.ts`
  (CBS catalog crawler + concept-matching helper).
