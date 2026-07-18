// A short/generic User-Agent string gets connection-reset by what looks
// like a CBS WAF rule (confirmed live testing); a realistic browser UA
// works reliably, so we send one defensively on every request.
const CBS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const CBS_BASE = "https://apis.cbs.gov.il";

export interface CbsCatalogCategory {
  id: string;
  title: string;
}

export interface CbsLeafSeries {
  seriesId: string;
  title: string;
  topLevelId: string;
}

export interface CbsSeriesResult {
  seriesId: string;
  title: string | null;
  updated: string | null;
  series: { year: number; value: number | null }[];
  rawUrl: string;
}

// CBS's API is intermittently flaky: the same, genuinely valid series ID
// can 500 on one request and 200 on the next (confirmed live — series
// 120010 failed on a retry with no request change). A short retry absorbs
// that transient noise; it never changes what data is returned, only
// whether a real, unmodified response gets through.
const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cbsFetch(pathAndQuery: string): Promise<unknown> {
  const url = `${CBS_BASE}/${pathAndQuery}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS * attempt);
    try {
      const res = await fetch(url, { headers: { "User-Agent": CBS_USER_AGENT } });
      if (!res.ok) {
        lastError = new Error(`CBS request failed: ${res.status} ${res.statusText} (${url})`);
        continue;
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) {
        // A non-JSON response means the endpoint doesn't exist / the
        // request shape is wrong — retrying won't help, fail immediately.
        throw new Error(`CBS returned a non-JSON response for ${url} — endpoint may not exist`);
      }
      return await res.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error(`CBS request failed for ${url}`);
}

async function cbsFetchXml(pathAndQuery: string): Promise<string> {
  const url = `${CBS_BASE}/${pathAndQuery}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS * attempt);
    try {
      const res = await fetch(url, { headers: { "User-Agent": CBS_USER_AGENT } });
      const text = await res.text();
      if (!res.ok || !text.trimStart().startsWith("<?xml")) {
        lastError = new Error(`CBS SDMX request failed: ${res.status} ${res.statusText} (${url}) — ${text.slice(0, 200)}`);
        continue;
      }
      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error(`CBS SDMX request failed for ${url}`);
}

interface CbsCatalogResponse {
  catalogs: {
    catalog: { path: number[]; name: string; pathDesc: string | null }[];
    level?: number;
  };
}

export async function fetchCbsTopLevel(lang: "en" | "he" = "en"): Promise<CbsCatalogCategory[]> {
  const json = (await cbsFetch(`series/catalog/level?id=1&format=json&lang=${lang}`)) as CbsCatalogResponse;
  return json.catalogs.catalog.map((c) => ({ id: String(c.path[0]), title: c.name }));
}

export async function fetchCbsLeafSeries(
  topLevelId: string,
  page = 1,
  pageSize = 100,
  lang: "en" | "he" = "en",
): Promise<CbsLeafSeries[]> {
  const json = (await cbsFetch(
    `series/catalog/path?id=${encodeURIComponent(topLevelId)}&format=json&lang=${lang}&pagesize=${pageSize}&page=${page}`,
  )) as CbsCatalogResponse;
  return json.catalogs.catalog.map((c) => ({
    seriesId: String(c.path[c.path.length - 1]),
    title: c.name,
    topLevelId: String(c.path[0]),
  }));
}

interface CbsDataListResponse {
  DataSet: {
    Series: {
      id: number;
      update: string | null;
      path: { name_id?: { name: string } };
      obs: { TimePeriod: string; Value: number | null }[];
    }[];
  };
}

function yearFromTimePeriod(tp: string): number | null {
  const m = /^(\d{4})/.exec(tp);
  return m ? Number(m[1]) : null;
}

export async function fetchCbsSeries(seriesId: string, lang: "en" | "he" = "en"): Promise<CbsSeriesResult> {
  const rawUrl = `${CBS_BASE}/series/data/list?id=${encodeURIComponent(seriesId)}&format=json&lang=${lang}`;
  const json = (await cbsFetch(
    `series/data/list?id=${encodeURIComponent(seriesId)}&format=json&lang=${lang}`,
  )) as CbsDataListResponse;
  const series = json.DataSet.Series[0];
  if (!series) {
    throw new Error(`CBS series ${seriesId} returned no data`);
  }

  // A CBS series can report multiple observations for the same year
  // (e.g. monthly data); we keep every observed point as its own year
  // bucket by averaging same-year points isn't done here — instead we
  // surface the most granular period as-is and let the caller decide,
  // since fabricating an aggregate would violate the never-fabricate rule.
  const byYear = new Map<number, number | null>();
  for (const o of series.obs) {
    const year = yearFromTimePeriod(o.TimePeriod);
    if (year === null) continue;
    if (!byYear.has(year)) byYear.set(year, o.Value);
  }
  const points = Array.from(byYear.entries())
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => a.year - b.year);

  return {
    seriesId,
    title: series.path?.name_id?.name ?? null,
    updated: series.update,
    series: points,
    rawUrl,
  };
}

// A second, separate CBS API — apis.cbs.gov.il/index/... — dedicated to
// price indices (CPI, housing prices, producer prices, construction input
// prices). Confirmed live 2026-07-18: unlike the general series/* API
// above (whose catalog leaf identifiers do not reliably correspond to the
// data actually returned — see CLAUDE.md), this API's codes and returned
// titles genuinely match (code 120010 -> "Consumer Price Index - General"
// with real percent/percentYear figures). Use Index/Catalog/Catalog to
// discover codes and this function to fetch one.
interface CbsPriceIndexResponse {
  month: {
    code: number;
    name: string;
    date: {
      year: number;
      month: number;
      percent: number | null;
      percentYear: number | null;
      currBase: { baseDesc: string; value: number | null } | null;
    }[];
  }[];
}

export interface CbsPriceIndexResult {
  code: string;
  title: string | null;
  updated: string | null;
  series: { year: number; value: number | null }[];
  rawUrl: string;
}

/** value: "level" returns the raw index level (base-year dependent, only
 *  meaningful alongside another series on the same base); "yoy" returns
 *  the year-over-year percent change (percentYear), which is comparable
 *  across different index bases — use this to pair with a Eurostat
 *  "rate of change" series. */
export async function fetchCbsPriceIndex(
  code: string,
  valueKind: "level" | "yoy",
  lang: "en" | "he" = "en",
): Promise<CbsPriceIndexResult> {
  const rawUrl = `${CBS_BASE}/index/data/price?id=${encodeURIComponent(code)}&format=json&lang=${lang}`;
  const json = (await cbsFetch(`index/data/price?id=${encodeURIComponent(code)}&format=json&lang=${lang}`)) as CbsPriceIndexResponse;
  const entry = json.month?.[0];
  if (!entry) {
    throw new Error(`CBS price index ${code} returned no data`);
  }

  // Data is typically ordered newest-first; take one point per year (the
  // first one seen, i.e. that year's most recent month) rather than
  // averaging — averaging would be a computed figure we didn't observe,
  // which the never-fabricate rule treats the same as any other estimate.
  const byYear = new Map<number, number | null>();
  let latestYear = -Infinity;
  let latestMonth = -Infinity;
  for (const d of entry.date) {
    if (!byYear.has(d.year)) {
      byYear.set(d.year, valueKind === "yoy" ? d.percentYear : (d.currBase?.value ?? null));
    }
    if (d.year > latestYear || (d.year === latestYear && d.month > latestMonth)) {
      latestYear = d.year;
      latestMonth = d.month;
    }
  }
  const points = Array.from(byYear.entries())
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => a.year - b.year);

  return {
    code,
    title: entry.name,
    updated: Number.isFinite(latestYear) ? `${latestYear}-${String(latestMonth).padStart(2, "0")}` : null,
    series: points,
    rawUrl,
  };
}

// A third, separate CBS access path — apis.cbs.gov.il/SDMX/DATA/{agency}/
// {dataflowId}/{version} — proxies IMF-standard SDMX dataflows for Israel.
// Confirmed live 2026-07-19 via agency=IMF, e.g. dataflow ECOFIN_POP
// (population, INDICATOR=LP_PE_NUM, REF_AREA=IL) returns genuinely correct
// monthly Israeli population data (4.8M in 1991 rising to 10.2M in 2026 —
// matches known real demographic history). The response's <Header><Sender>
// identifies as "Israeli Central Bureau of Statistics", so this is CBS's
// own data reported through an IMF-standard schema, not third-party IMF
// estimates. Most ECOFIN_* dataflow IDs return {"Message":"Error: Sdmx"}
// (HTTP 500) rather than real data — only a handful are actually mirrored
// (confirmed working: ECOFIN_CBS, ECOFIN_BOP, ECOFIN_GGO, ECOFIN_FSI,
// ECOFIN_CPI, ECOFIN_POP, ECOFIN_PPI, ECOFIN_EMP) — always verify a new ID
// via npm run verify before adding it to cbs-indicator-map.json.
export interface CbsSdmxResult {
  dataflowId: string;
  title: string | null;
  updated: string | null;
  series: { year: number; value: number | null }[];
  rawUrl: string;
}

function unescapeXmlAttr(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export async function fetchCbsSdmx(
  agency: string,
  dataflowId: string,
  version: string = "1",
): Promise<CbsSdmxResult> {
  const rawUrl = `${CBS_BASE}/SDMX/DATA/${encodeURIComponent(agency)}/${encodeURIComponent(dataflowId)}/${encodeURIComponent(version)}`;
  const xml = await cbsFetchXml(`SDMX/DATA/${encodeURIComponent(agency)}/${encodeURIComponent(dataflowId)}/${encodeURIComponent(version)}`);

  const nameMatch = /<Name xml:lang="en">([^<]*)<\/Name>/.exec(xml);
  const title = nameMatch ? unescapeXmlAttr(nameMatch[1]) : null;

  const unitMultMatch = /UNIT_MULT="(-?\d+)"/.exec(xml);
  const unitMult = unitMultMatch ? 10 ** Number(unitMultMatch[1]) : 1;

  const obsRe = /<tis:Obs TIME_PERIOD="(\d{4})-(\d{2})" OBS_VALUE="([^"]*)"\s*\/>/g;
  const byYear = new Map<number, number | null>();
  let match: RegExpExecArray | null;
  while ((match = obsRe.exec(xml)) !== null) {
    const year = Number(match[1]);
    if (byYear.has(year)) continue;
    const raw = match[3];
    const value = raw === "NaN" || raw === "" ? null : Number(raw) * unitMult;
    byYear.set(year, value === null || Number.isNaN(value) ? null : value);
  }
  if (byYear.size === 0) {
    throw new Error(`CBS SDMX dataflow ${dataflowId} returned no observations`);
  }
  const points = Array.from(byYear.entries())
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => a.year - b.year);
  const latestYearWithData = points[points.length - 1].year;

  return {
    dataflowId,
    title,
    updated: String(latestYearWithData),
    series: points,
    rawUrl,
  };
}
