export type Locale = "en" | "he";

export type DataSource = "eurostat" | "cbs";

export interface SeriesPoint {
  year: number;
  value: number | null;
}

export interface Provenance {
  code: string;
  source: DataSource;
  updated: string | null;
  rawUrl: string;
}

export interface EurostatDatasetResponse {
  datasetCode: string;
  title: string;
  source: "eurostat";
  updated: string | null;
  hasIsrael: boolean;
  hasEuAggregate: boolean;
  euAggregateCode: string | null;
  availableGeoCodes: string[];
  geoLabels: Record<string, string>;
  selectedFilters: Record<string, string>;
  series: Record<string, SeriesPoint[]>;
  rawUrl: string;
}

export interface CbsSeriesResponse {
  seriesId: string;
  title: string | null;
  source: "cbs";
  updated: string | null;
  series: SeriesPoint[];
  rawUrl: string;
}

export interface CbsPriceIndexResponse {
  code: string;
  title: string | null;
  source: "cbs";
  updated: string | null;
  series: SeriesPoint[];
  rawUrl: string;
}

export interface CbsSdmxResponse {
  dataflowId: string;
  title: string | null;
  source: "cbs";
  updated: string | null;
  series: SeriesPoint[];
  rawUrl: string;
}

export interface TocDataset {
  code: string;
  title: string;
  type: string;
  lastUpdate: string | null;
}

export interface TocNode {
  id: string;
  title: string;
  children: TocNode[];
  datasets: TocDataset[];
}

export interface CbsCatalogCategory {
  id: string;
  title: string;
}

export interface CbsLeafSeries {
  seriesId: string;
  title: string;
  topLevelId: string;
}

export interface CbsIndexEntry {
  seriesId: string;
  title: string;
  topLevelId: string;
  topLevelTitle: string;
}

export interface FlatIndicator {
  code: string;
  title: string;
  type: string;
  breadcrumb: string[];
}

export interface IndicatorMapping {
  key: string;
  labelEn: string;
  labelHe: string;
  eurostatDatasetCode: string;
  euFilterOverrides?: Record<string, string>;
  cbsApiType: "series" | "index" | "sdmx";
  cbsCode: string;
  cbsValueKind?: "level" | "yoy";
  cbsSdmxAgency?: string;
  cbsSdmxVersion?: string;
  verifiedAt: string;
  notes?: string;
}
