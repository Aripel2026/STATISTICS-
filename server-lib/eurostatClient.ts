export interface JsonStatDimensionCategory {
  index?: Record<string, number> | string[];
  label?: Record<string, string>;
}

export interface JsonStatDimension {
  label?: string;
  category: JsonStatDimensionCategory;
}

export interface JsonStatDataset {
  version?: string;
  class?: string;
  label?: string;
  updated?: string;
  id: string[];
  size: number[];
  dimension: Record<string, JsonStatDimension>;
  value: Record<string, number> | (number | null)[];
}

export interface EurostatDatasetResult {
  datasetCode: string;
  title: string;
  updated: string | null;
  hasIsrael: boolean;
  hasEuAggregate: boolean;
  euAggregateCode: string | null;
  availableGeoCodes: string[];
  geoLabels: Record<string, string>;
  selectedFilters: Record<string, string>;
  series: Record<string, { year: number; value: number | null }[]>;
  rawUrl: string;
}

const EU_AGGREGATE_CANDIDATES = ["EU27_2020", "EU28", "EU27_2007", "EA20", "EA19"];

function categoryCodes(cat: JsonStatDimensionCategory): string[] {
  if (Array.isArray(cat.index)) return cat.index;
  if (cat.index) {
    return Object.entries(cat.index)
      .sort((a, b) => a[1] - b[1])
      .map(([code]) => code);
  }
  if (cat.label) return Object.keys(cat.label);
  return [];
}

function codeToPosition(cat: JsonStatDimensionCategory, code: string): number | undefined {
  if (Array.isArray(cat.index)) {
    const pos = cat.index.indexOf(code);
    return pos >= 0 ? pos : undefined;
  }
  if (cat.index) return cat.index[code];
  return undefined;
}

const RANGE_CODE_RE = /^Y(\d+)-(\d+)$/;

function widestRangeCode(codes: string[]): string | undefined {
  let best: { code: string; span: number } | undefined;
  for (const code of codes) {
    const m = RANGE_CODE_RE.exec(code);
    if (!m) continue;
    const span = Number(m[2]) - Number(m[1]);
    if (!best || span > best.span) best = { code, span };
  }
  return best?.code;
}

function pickDefaultCode(cat: JsonStatDimensionCategory): string | undefined {
  const codes = categoryCodes(cat);
  if (codes.length === 0) return undefined;
  const totalByCode = codes.find((c) => c.toUpperCase() === "TOTAL" || c === "T");
  if (totalByCode) return totalByCode;
  if (cat.label) {
    const totalByLabel = codes.find((c) => (cat.label![c] ?? "").toLowerCase().includes("total"));
    if (totalByLabel) return totalByLabel;
  }
  // For age-band-style dimensions with no "total" category, the widest
  // numeric range is the closest generic proxy for a headline figure
  // (e.g. Y15-74 over Y15-24) without hardcoding per-indicator knowledge.
  const widest = widestRangeCode(codes);
  if (widest) return widest;
  return codes[0];
}

function buildStrides(sizes: number[]): number[] {
  const strides = new Array(sizes.length).fill(1);
  for (let i = sizes.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * sizes[i + 1];
  }
  return strides;
}

function valueAt(dataset: JsonStatDataset, linearIndex: number): number | null {
  if (Array.isArray(dataset.value)) {
    const v = dataset.value[linearIndex];
    return v === undefined || v === null ? null : v;
  }
  const v = dataset.value[String(linearIndex)];
  return v === undefined || v === null ? null : v;
}

export function parseJsonStat(datasetCode: string, rawUrl: string, dataset: JsonStatDataset): EurostatDatasetResult {
  const dims = dataset.id;
  const strides = buildStrides(dataset.size);

  const geoDimName = dims.includes("geo") ? "geo" : undefined;
  const timeDimName = dims.includes("time") ? "time" : undefined;
  if (!geoDimName || !timeDimName) {
    throw new Error(`Dataset ${datasetCode} is missing geo or time dimension`);
  }

  const geoDim = dataset.dimension[geoDimName];
  const timeDim = dataset.dimension[timeDimName];
  const geoCodes = categoryCodes(geoDim.category);
  const timeCodes = categoryCodes(timeDim.category);
  const geoLabels: Record<string, string> = {};
  for (const code of geoCodes) {
    geoLabels[code] = geoDim.category.label?.[code] ?? code;
  }

  const hasIsrael = geoCodes.includes("IL");
  const euAggregateCode = EU_AGGREGATE_CANDIDATES.find((c) => geoCodes.includes(c)) ?? null;

  const selectedFilters: Record<string, string> = {};
  const fixedPositions: Record<string, number> = {};
  for (const dimName of dims) {
    if (dimName === geoDimName || dimName === timeDimName) continue;
    const cat = dataset.dimension[dimName].category;
    const defaultCode = pickDefaultCode(cat);
    if (defaultCode === undefined) continue;
    const pos = codeToPosition(cat, defaultCode);
    if (pos === undefined) continue;
    fixedPositions[dimName] = pos;
    selectedFilters[dimName] = defaultCode;
  }

  const series: Record<string, { year: number; value: number | null }[]> = {};
  const geoDimIdx = dims.indexOf(geoDimName);
  const timeDimIdx = dims.indexOf(timeDimName);

  for (const geoCode of geoCodes) {
    const geoPos = codeToPosition(geoDim.category, geoCode);
    if (geoPos === undefined) continue;
    const points: { year: number; value: number | null }[] = [];
    for (const timeCode of timeCodes) {
      const timePos = codeToPosition(timeDim.category, timeCode);
      if (timePos === undefined) continue;
      let linearIndex = 0;
      for (let i = 0; i < dims.length; i++) {
        const dimName = dims[i];
        let pos: number;
        if (i === geoDimIdx) pos = geoPos;
        else if (i === timeDimIdx) pos = timePos;
        else pos = fixedPositions[dimName] ?? 0;
        linearIndex += pos * strides[i];
      }
      const year = Number.parseInt(timeCode, 10);
      if (Number.isNaN(year)) continue;
      points.push({ year, value: valueAt(dataset, linearIndex) });
    }
    points.sort((a, b) => a.year - b.year);
    series[geoCode] = points;
  }

  return {
    datasetCode,
    title: dataset.label ?? datasetCode,
    updated: dataset.updated ?? null,
    hasIsrael,
    hasEuAggregate: euAggregateCode !== null,
    euAggregateCode,
    availableGeoCodes: geoCodes,
    geoLabels,
    selectedFilters,
    series,
    rawUrl,
  };
}

export async function fetchEurostatDataset(datasetCode: string): Promise<EurostatDatasetResult> {
  const rawUrl = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${encodeURIComponent(
    datasetCode,
  )}?format=JSON`;
  const res = await fetch(rawUrl);
  if (!res.ok) {
    throw new Error(`Eurostat request failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as JsonStatDataset;
  return parseJsonStat(datasetCode, rawUrl, json);
}
