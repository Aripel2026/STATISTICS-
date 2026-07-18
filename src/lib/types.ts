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
  series: Record<string, SeriesPoint[]>;
  rawUrl: string;
}

export interface CbsSeriesResponse {
  seriesId: string;
  titleHe: string | null;
  titleEn: string | null;
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
  titleHe: string | null;
  titleEn: string | null;
}

export interface CbsLeafSeries {
  seriesId: string;
  titleHe: string | null;
  titleEn: string | null;
  topLevelId: string;
}

export interface IndicatorMapping {
  key: string;
  eurostatDatasetCode: string;
  cbsSeriesId: string;
  labelEn: string;
  labelHe: string;
  verifiedAt: string;
  notes?: string;
}
