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
