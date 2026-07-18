import { useI18n } from "../i18n";
import { EU27_CODES } from "../lib/euCountries";
import type { EurostatDatasetResponse, SeriesPoint } from "../lib/types";

interface MapViewProps {
  dataset: EurostatDatasetResponse;
  israelPoints: SeriesPoint[] | null;
}

function latestValue(points: SeriesPoint[] | undefined): SeriesPoint | null {
  if (!points || points.length === 0) return null;
  const withValue = [...points].reverse().find((p) => p.value !== null);
  return withValue ?? points[points.length - 1];
}

export default function MapView({ dataset, israelPoints }: MapViewProps) {
  const { t } = useI18n();
  const rows = EU27_CODES.filter((code) => dataset.availableGeoCodes.includes(code));
  const israelLatest = latestValue(israelPoints ?? undefined);

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>{t("compare.selectCountry")}</th>
            <th>{t("provenance.updated")}</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>{t("provenance.cbs")}</strong>
            </td>
            <td colSpan={2}>
              {israelLatest ? `${israelLatest.year}: ${israelLatest.value ?? t("nodata.title")}` : t("nodata.noMapping")}
            </td>
          </tr>
          {dataset.euAggregateCode && (
            <tr>
              <td>
                <strong>{dataset.geoLabels[dataset.euAggregateCode] ?? dataset.euAggregateCode}</strong>
              </td>
              <td colSpan={2}>
                {(() => {
                  const latest = latestValue(dataset.series[dataset.euAggregateCode!]);
                  return latest ? `${latest.year}: ${latest.value ?? t("nodata.title")}` : t("nodata.title");
                })()}
              </td>
            </tr>
          )}
          {rows.map((code) => {
            const latest = latestValue(dataset.series[code]);
            return (
              <tr key={code}>
                <td>{dataset.geoLabels[code] ?? code}</td>
                <td>{latest ? latest.year : "—"}</td>
                <td>{latest ? (latest.value ?? t("nodata.title")) : t("nodata.title")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
