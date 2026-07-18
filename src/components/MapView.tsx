import { useI18n } from "../i18n";
import type { EurostatDatasetResponse, SeriesPoint } from "../lib/types";

interface MapViewProps {
  dataset: EurostatDatasetResponse;
  geoCodes: string[];
  includeEuAggregate: boolean;
  includeIsrael: boolean;
  israelPoints: SeriesPoint[] | null;
  israelLabel: string;
}

interface Row {
  key: string;
  label: string;
  kind: "il" | "eu" | "country";
  latest: SeriesPoint | null;
}

function latestValue(points: SeriesPoint[] | undefined): SeriesPoint | null {
  if (!points || points.length === 0) return null;
  const withValue = [...points].reverse().find((p) => p.value !== null);
  return withValue ?? points[points.length - 1];
}

export default function MapView({
  dataset,
  geoCodes,
  includeEuAggregate,
  includeIsrael,
  israelPoints,
  israelLabel,
}: MapViewProps) {
  const { t } = useI18n();

  const rows: Row[] = [];
  if (includeIsrael) {
    rows.push({ key: "il", label: israelLabel, kind: "il", latest: latestValue(israelPoints ?? undefined) });
  }
  if (includeEuAggregate && dataset.euAggregateCode) {
    rows.push({
      key: dataset.euAggregateCode,
      label: dataset.geoLabels[dataset.euAggregateCode] ?? dataset.euAggregateCode,
      kind: "eu",
      latest: latestValue(dataset.series[dataset.euAggregateCode]),
    });
  }
  for (const code of geoCodes) {
    rows.push({
      key: code,
      label: dataset.geoLabels[code] ?? code,
      kind: "country",
      latest: latestValue(dataset.series[code]),
    });
  }

  const sorted = [...rows].sort((a, b) => {
    if (a.latest?.value == null && b.latest?.value == null) return 0;
    if (a.latest?.value == null) return 1;
    if (b.latest?.value == null) return -1;
    return b.latest.value - a.latest.value;
  });

  return (
    <div className="rank-list">
      <div className="rank-list-header">
        <span>{t("table.rank")}</span>
        <span>{t("table.region")}</span>
        <span>{t("table.year")}</span>
        <span>{t("table.latestValue")}</span>
      </div>
      {sorted.map((row, i) => (
        <div key={row.key} className={`rank-row rank-row-${row.kind}`}>
          <span className="rank-row-index">{i + 1}</span>
          <span className="rank-row-label">{row.label}</span>
          <span className="rank-row-year">{row.latest ? row.latest.year : "—"}</span>
          <span className="rank-row-value">
            {row.latest && row.latest.value !== null ? row.latest.value.toLocaleString() : (
              <span className="rank-row-nodata">{t("table.noData")}</span>
            )}
          </span>
        </div>
      ))}
      {sorted.length === 0 && <p className="loading-text">{t("catalog.selectDataset")}</p>}
    </div>
  );
}
