import type {
  CbsCatalogCategory,
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

export function fetchCbsTopLevel(): Promise<CbsCatalogCategory[]> {
  return getJson<CbsCatalogCategory[]>("/api/cbs/catalog-level");
}

export function fetchCbsLeafSeries(topLevelId: string, page = 1): Promise<CbsLeafSeries[]> {
  return getJson<CbsLeafSeries[]>(
    `/api/cbs/catalog-path?id=${encodeURIComponent(topLevelId)}&page=${page}`,
  );
}

export function fetchCbsSeries(id: string): Promise<CbsSeriesResponse> {
  return getJson<CbsSeriesResponse>(`/api/cbs/series/${encodeURIComponent(id)}`);
}

export function fetchIndicatorMappings(): Promise<IndicatorMapping[]> {
  return getJson<IndicatorMapping[]>("/api/indicators/mapped");
}
