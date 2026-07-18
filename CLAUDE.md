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

## UI architecture: one page, no mode toggle

The app is a single page (`Dashboard.tsx`). An earlier version had a
top-level "Verified comparisons" / "Browse all Eurostat data" mode toggle;
user feedback was that switching between two equal-weight modes was itself
friction, so it's gone. The primary (and only default-visible) view is:

- **Curated indicator cards**: `cbs-indicator-map.json` entries, shown as
  plain click cards — no search step, no mode to pick first. Both sides
  (Eurostat + CBS) are pre-verified to use the *same measure* (e.g. annual
  % change), so they share one chart axis and are genuinely comparable, not
  just visually overlaid. Clicking a card immediately loads both sides —
  this is what satisfies "only show data that's actually comparable" and
  "as few steps as possible to see a chart."
- **"Looking for something else?" text link** (not a tab/toggle): reveals
  `IndicatorSearch` (client-side substring search over the flattened
  Eurostat TOC, with a "browse by category" fallback using `CatalogTree`)
  for the ~10,000 Eurostat indicators with no verified Israel match. Here
  the user can search CBS themselves (`CbsSeriesPicker` / `/api/cbs/search`)
  and manually attach a series, explicitly labeled "manually selected — not
  an automatic match" and given its own secondary chart axis
  (`ChartSeries.secondaryAxis`)
  since its unit/scale isn't guaranteed comparable — never silently plotted
  as if it were a verified pairing.

Both modes share `CountrySelector` (multi-select EU member states + EU
aggregate + Israel toggle, all shown simultaneously) and an
`IndicatorChart` / `MapView` toggle.

## Data flow: two separate CBS APIs (important)

CBS actually exposes **two unrelated APIs** under `apis.cbs.gov.il`, and
conflating them was the source of a lot of wasted effort in this project's
history:

1. **`series/*`** (`cbsClient.ts`'s `fetchCbsSeries`/`fetchCbsTopLevel`/
   `fetchCbsLeafSeries`) — a general time-series catalog. **Confirmed
   unreliable for concept-matching** (live 2026-07-19): a catalog leaf's own
   title can be flatly wrong for what `series/data/list` actually returns
   for that ID (e.g. a leaf labeled "Exports, Total" resolves to an
   unrelated imports sub-series; browsing under "Population" or "Labour"
   turns up country names like "Spain"/"Poland" as the real fetched title).
   The root cause: the catalog's leaf number is a `name_id` (a label
   dimension value), not the real queryable series ID — there is no
   documented way to go from one to the other. Exhaustive keyword-matching
   + real-title-corroboration passes across all 34 categories, for 10
   major concepts, found **zero** trustworthy matches this way. Only use
   this API for the user-driven manual-attach flow (`CbsSeriesPicker`),
   never for automated pairing.
2. **`index/*`** (`cbsClient.ts`'s `fetchCbsPriceIndex`, discovered
   2026-07-19 via web search — it isn't linked from the `series/*` docs) —
   a **separate, dedicated, well-behaved** API for price indices only
   (CPI, housing/dwelling prices, producer prices, construction input
   prices). `apis.cbs.gov.il/Index/Catalog/Catalog?lang=en` and
   `apis.cbs.gov.il/index/catalog/tree?lang=en` return a real, correctly
   labeled catalog (code `120010` genuinely is "Consumer Price Index -
   General"; verified by cross-checking the catalog label against the
   actual `index/data/price?id=...` response). This is the *only* CBS
   source used for `cbs-indicator-map.json` today. It does not cover
   unemployment, population, GDP, life expectancy, or wages — no
   equivalent dedicated API for those was found (see the historical
   `data/cbs-indicator-map.json` git history / this section for what was
   tried: catalog crawling, `series/data/path`, guessed API domain names
   like `apis.cbs.gov.il/labour/...` and 12 other topic-name guesses (all
   returned the generic CBS error page, not real data), an SDMX endpoint
   (CBS is not a listed SDMX-Central participant and no `sdmx/rest/...`
   path responded — only Bank of Israel, a separate agency, implements
   SDMX), and CBS's own website via WebFetch (consistent 403s on every
   page tried, including with query-string bypass tricks found via
   search). One piece of corroborating evidence this isn't a gap in
   research but a real scope limit: CBS's own Hebrew page for this API is
   titled "מדדי מחירים באמצעות API" — "Price Indices via API" — i.e. CBS
   itself scopes this dedicated API to prices only. A future session with
   actual browser access to CBS's website (blocked here by both the
   sandbox's egress policy and CBS's WAF returning 403 to fetch tools)
   might find more dedicated APIs the same way this one was found — via
   web search for real
   `apis.cbs.gov.il/...` URLs already in use, not by guessing.

**Comparability requires matching the measure, not just the concept.**
Both curated entries pair a CBS `percentYear` (year-over-year % change)
against a Eurostat series explicitly filtered to a "rate of change" unit
(`RCH_A_AVG`), via `IndicatorMapping.euFilterOverrides`. Do **not** pair a
raw CBS index level against a raw Eurostat index level — they use
different, unrelated base years and are not comparable as plotted values,
even though both are "real" numbers. Rate-of-change is the safe common
unit for indices with different bases.

**CBS's `series/data/list` and `index/data/price` are both intermittently
flaky**: the same, genuinely valid ID can return 500 on one request and 200
on the next with no change in the request. `cbsClient.ts` retries
transient failures a couple of times before giving up.

**Performance note**: pass `euFilterOverrides` through to the actual
Eurostat HTTP request as query params (`fetchEurostatDataset`'s second
argument does this), not just as a post-fetch filter — Eurostat supports
server-side filtering, and for a dataset with many unit/breakdown
combinations this is the difference between an ~8s response (full
dataset) and ~0.2s (filtered). Confirmed live on `prc_hicp_aind`.

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

**Also confirmed live**: `vercel.json`'s `functions` config rejects two
patterns that both match the same file (e.g. a wildcard `api/**/*.ts` plus
a literal `api/cbs/search.ts` override) with a hard build failure — "The
pattern ... doesn't match any Serverless Functions". Use one pattern per
file; if one route needs different settings, it needs its own non-overlapping
glob, not an additional literal entry alongside the wildcard.

## Layout

- `/src` — Vite React frontend.
- `/api` — Vercel serverless functions (the proxy layer: CORS, CBS
  User-Agent header, response caching).
- `/server-lib` — shared Node code used only by `/api`, not shipped to the
  browser.
- `/data` — `cbs-indicator-map.json` (curated mapping, `index/*` API only —
  see above), `toc-snapshot.json` (pre-parsed Eurostat TOC).
- `server-lib/cbsIndex.ts` — crawls all CBS top-level categories (1 page
  each, `series/*` API) into a cached, searchable index backing
  `/api/cbs/search`, used only by the manual CBS-attach picker in advanced
  mode (never for automated pairing — see the reliability note above).
  Cache TTL 6h; first request after a cold start pays the full crawl cost.
- `/scripts` — `verify.ts` (mandatory readiness gate), `discover-cbs.ts`
  (CBS catalog crawler + concept-matching helper).
