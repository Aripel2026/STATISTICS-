import type {
  CbsCatalogCategory,
  CbsIndexEntry,
  CbsLeafSeries,
  CbsSeriesResponse,
  EurostatDatasetResponse,
  IndicatorMapping,
  TocNode,
} from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export function fetchToc(): Promise<TocNode> {
  return getJson<TocNode>("/api/catalog/toc");
}

export function fetchEurostatDataset(code: string): Promise<EurostatDatasetResponse> {
  return getJson<EurostatDatasetResponse>(`/api/eurostat/dataset/${encodeURIComponent(code)}`);
}

export function fetchCbsTopLevel(lang: "en" | "he" = "en"): Promise<CbsCatalogCategory[]> {
  return getJson<CbsCatalogCategory[]>(`/api/cbs/catalog-level?lang=${lang}`);
}

export function fetchCbsLeafSeries(
  topLevelId: string,
  page = 1,
  lang: "en" | "he" = "en",
): Promise<CbsLeafSeries[]> {
  return getJson<CbsLeafSeries[]>(
    `/api/cbs/catalog-path?id=${encodeURIComponent(topLevelId)}&page=${page}&lang=${lang}`,
  );
}

export function fetchCbsSeries(id: string, lang: "en" | "he" = "en"): Promise<CbsSeriesResponse> {
  return getJson<CbsSeriesResponse>(`/api/cbs/series/${encodeURIComponent(id)}?lang=${lang}`);
}

export function fetchIndicatorMappings(): Promise<IndicatorMapping[]> {
  return getJson<IndicatorMapping[]>("/api/indicators/mapped");
}

export function searchCbsSeries(query: string): Promise<CbsIndexEntry[]> {
  return getJson<CbsIndexEntry[]>(`/api/cbs/search?q=${encodeURIComponent(query)}`);
}
