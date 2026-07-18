import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import {
  fetchCbsSeries,
  fetchEurostatDataset,
  fetchIndicatorMappings,
  fetchToc,
} from "../lib/api";
import { flattenToc } from "../lib/flattenToc";
import type {
  CbsSeriesResponse,
  EurostatDatasetResponse,
  IndicatorMapping,
  Provenance,
  TocNode,
} from "../lib/types";
import CbsSeriesPicker from "./CbsSeriesPicker";
import CountrySelector from "./CountrySelector";
import IndicatorChart, { type ChartSeries } from "./IndicatorChart";
import IndicatorSearch from "./IndicatorSearch";
import MapView from "./MapView";
import NoDataNotice from "./NoDataNotice";
import ProvenanceFooter from "./ProvenanceFooter";

const CHART_COLORS = ["#5b9dff", "#34c98f", "#ffb454", "#ff7b7b", "#c58cff", "#4dd6d0", "#f28cb1", "#a3c957"];

export default function Dashboard() {
  const { t } = useI18n();
  const [toc, setToc] = useState<TocNode | null>(null);
  const [tocError, setTocError] = useState(false);
  const flatList = useMemo(() => (toc ? flattenToc(toc) : []), [toc]);

  const [mappings, setMappings] = useState<IndicatorMapping[]>([]);

  const [selected, setSelected] = useState<{ code: string; title: string } | null>(null);
  const [dataset, setDataset] = useState<EurostatDatasetResponse | null>(null);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [datasetError, setDatasetError] = useState(false);

  const [selectedGeoCodes, setSelectedGeoCodes] = useState<string[]>([]);
  const [includeEuAggregate, setIncludeEuAggregate] = useState(true);
  const [includeIsrael, setIncludeIsrael] = useState(true);

  const [cbsSeriesId, setCbsSeriesId] = useState<string | null>(null);
  const [cbsManuallyPicked, setCbsManuallyPicked] = useState(false);
  const [cbsSeriesData, setCbsSeriesData] = useState<CbsSeriesResponse | null>(null);
  const [cbsLoading, setCbsLoading] = useState(false);
  const [cbsError, setCbsError] = useState(false);
  const [showCbsPicker, setShowCbsPicker] = useState(false);

  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  useEffect(() => {
    fetchToc().then(setToc).catch(() => setTocError(true));
    fetchIndicatorMappings().then(setMappings).catch(() => setMappings([]));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setDatasetLoading(true);
    setDatasetError(false);
    setDataset(null);
    setSelectedGeoCodes([]);
    setIncludeEuAggregate(true);
    setIncludeIsrael(true);
    setCbsSeriesData(null);
    setShowCbsPicker(false);

    const mapping = mappings.find((m) => m.eurostatDatasetCode === selected.code);
    setCbsSeriesId(mapping?.cbsSeriesId ?? null);
    setCbsManuallyPicked(false);

    fetchEurostatDataset(selected.code)
      .then(setDataset)
      .catch(() => setDatasetError(true))
      .finally(() => setDatasetLoading(false));
  }, [selected, mappings]);

  useEffect(() => {
    if (!includeIsrael || !cbsSeriesId) {
      setCbsSeriesData(null);
      return;
    }
    setCbsLoading(true);
    setCbsError(false);
    fetchCbsSeries(cbsSeriesId)
      .then(setCbsSeriesData)
      .catch(() => setCbsError(true))
      .finally(() => setCbsLoading(false));
  }, [includeIsrael, cbsSeriesId]);

  const provenanceLines: Provenance[] = useMemo(() => {
    const lines: Provenance[] = [];
    if (dataset) {
      lines.push({ code: dataset.datasetCode, source: "eurostat", updated: dataset.updated, rawUrl: dataset.rawUrl });
    }
    if (cbsSeriesData) {
      lines.push({ code: cbsSeriesData.seriesId, source: "cbs", updated: cbsSeriesData.updated, rawUrl: cbsSeriesData.rawUrl });
    }
    return lines;
  }, [dataset, cbsSeriesData]);

  const chartSeries: ChartSeries[] = useMemo(() => {
    if (!dataset) return [];
    const series: ChartSeries[] = [];
    let colorIdx = 0;
    if (includeIsrael && cbsSeriesData) {
      series.push({
        label: t("provenance.cbs"),
        color: "#34c98f",
        points: cbsSeriesData.series,
        secondaryAxis: cbsManuallyPicked,
      });
    }
    if (includeEuAggregate && dataset.euAggregateCode && dataset.series[dataset.euAggregateCode]) {
      series.push({
        label: dataset.geoLabels[dataset.euAggregateCode] ?? dataset.euAggregateCode,
        color: "#ffb454",
        points: dataset.series[dataset.euAggregateCode],
      });
    }
    for (const code of selectedGeoCodes) {
      if (!dataset.series[code]) continue;
      series.push({
        label: dataset.geoLabels[code] ?? code,
        color: CHART_COLORS[colorIdx % CHART_COLORS.length],
        points: dataset.series[code],
      });
      colorIdx++;
    }
    return series;
  }, [dataset, includeIsrael, cbsSeriesData, cbsManuallyPicked, includeEuAggregate, selectedGeoCodes, t]);

  return (
    <div>
      <div className="panel">
        <IndicatorSearch
          toc={toc}
          flatList={flatList}
          selectedCode={selected?.code ?? null}
          onSelect={(code, title) => setSelected({ code, title })}
        />
        {tocError && <p className="error-text">{t("catalog.error")}</p>}
      </div>

      {!selected && (
        <div className="panel">
          <p className="loading-text">{t("catalog.selectDataset")}</p>
        </div>
      )}

      {selected && (
        <div className="panel">
          <h2 className="panel-title">{selected.title}</h2>
          {datasetLoading && <p className="loading-text">{t("catalog.loading")}</p>}
          {datasetError && <NoDataNotice reason="loadFailed" />}

          {dataset && (
            <>
              <CountrySelector
                dataset={dataset}
                selectedGeoCodes={selectedGeoCodes}
                onChangeGeoCodes={setSelectedGeoCodes}
                includeEuAggregate={includeEuAggregate}
                onToggleEuAggregate={setIncludeEuAggregate}
                includeIsrael={includeIsrael}
                onToggleIsrael={setIncludeIsrael}
              />

              {!dataset.hasIsrael && includeIsrael && (
                <p className="loading-text" style={{ marginBlockEnd: "0.5rem" }}>
                  {t("nodata.noIsrael")}
                </p>
              )}

              {includeIsrael && (
                <div style={{ marginBlockEnd: "1rem" }}>
                  {cbsSeriesId && !showCbsPicker && (
                    <div className="selector-row">
                      <span className="loading-text">
                        {cbsLoading
                          ? t("catalog.loading")
                          : cbsSeriesData?.title ?? cbsSeriesId}
                        {" — "}
                        {cbsManuallyPicked ? t("cbsPicker.manual") : t("cbsPicker.mapped")}
                      </span>
                      <button type="button" className="link-button" onClick={() => setShowCbsPicker(true)}>
                        {t("cbsPicker.change")}
                      </button>
                    </div>
                  )}
                  {cbsError && <NoDataNotice reason="loadFailed" />}
                  {(!cbsSeriesId || showCbsPicker) && (
                    <CbsSeriesPicker
                      onSelect={(id, title) => {
                        setCbsSeriesId(id);
                        setCbsManuallyPicked(true);
                        setShowCbsPicker(false);
                        setCbsSeriesData((prev) => (prev && prev.seriesId === id ? prev : null));
                        void title;
                      }}
                    />
                  )}
                  {!cbsSeriesId && !showCbsPicker && <NoDataNotice reason="noMapping" />}
                </div>
              )}

              <div className="selector-row">
                <button
                  type="button"
                  className="nav-button"
                  aria-current={viewMode === "chart" ? "page" : undefined}
                  onClick={() => setViewMode("chart")}
                >
                  {t("view.chart")}
                </button>
                <button
                  type="button"
                  className="nav-button"
                  aria-current={viewMode === "table" ? "page" : undefined}
                  onClick={() => setViewMode("table")}
                >
                  {t("view.table")}
                </button>
              </div>

              {viewMode === "chart" &&
                (chartSeries.length > 0 ? (
                  <IndicatorChart title={dataset.title} seriesList={chartSeries} />
                ) : (
                  <NoDataNotice reason="missingValue" />
                ))}

              {viewMode === "table" && (
                <MapView
                  dataset={dataset}
                  geoCodes={selectedGeoCodes}
                  includeEuAggregate={includeEuAggregate}
                  includeIsrael={includeIsrael}
                  israelPoints={cbsSeriesData?.series ?? null}
                  israelLabel={t("provenance.cbs")}
                />
              )}

              {provenanceLines.length > 0 && <ProvenanceFooter lines={provenanceLines} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
