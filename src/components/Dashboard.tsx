import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import {
  fetchCbsPriceIndex,
  fetchCbsSeries,
  fetchEurostatDataset,
  fetchIndicatorMappings,
  fetchToc,
} from "../lib/api";
import { flattenToc } from "../lib/flattenToc";
import type {
  EurostatDatasetResponse,
  IndicatorMapping,
  Provenance,
  SeriesPoint,
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

interface IsraelData {
  id: string;
  title: string | null;
  updated: string | null;
  series: SeriesPoint[];
  rawUrl: string;
}

export default function Dashboard() {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<"curated" | "advanced">("curated");

  const [mappings, setMappings] = useState<IndicatorMapping[]>([]);
  const [selectedMapping, setSelectedMapping] = useState<IndicatorMapping | null>(null);

  const [toc, setToc] = useState<TocNode | null>(null);
  const [tocError, setTocError] = useState(false);
  const flatList = useMemo(() => (toc ? flattenToc(toc) : []), [toc]);
  const [selected, setSelected] = useState<{ code: string; title: string } | null>(null);

  const [dataset, setDataset] = useState<EurostatDatasetResponse | null>(null);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [datasetError, setDatasetError] = useState(false);

  const [selectedGeoCodes, setSelectedGeoCodes] = useState<string[]>([]);
  const [includeEuAggregate, setIncludeEuAggregate] = useState(true);
  const [includeIsrael, setIncludeIsrael] = useState(true);

  const [israelData, setIsraelData] = useState<IsraelData | null>(null);
  const [israelLoading, setIsraelLoading] = useState(false);
  const [israelError, setIsraelError] = useState(false);

  // Advanced mode only: manual CBS attach (no curated/verified match exists).
  const [manualCbsId, setManualCbsId] = useState<string | null>(null);
  const [showCbsPicker, setShowCbsPicker] = useState(false);

  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  useEffect(() => {
    fetchIndicatorMappings().then(setMappings).catch(() => setMappings([]));
    fetchToc().then(setToc).catch(() => setTocError(true));
  }, []);

  // Curated mode: load the Eurostat side for the chosen mapping.
  useEffect(() => {
    if (mode !== "curated" || !selectedMapping) return;
    setDatasetLoading(true);
    setDatasetError(false);
    setDataset(null);
    setSelectedGeoCodes([]);
    setIncludeEuAggregate(true);
    setIncludeIsrael(true);

    fetchEurostatDataset(selectedMapping.eurostatDatasetCode, selectedMapping.euFilterOverrides)
      .then(setDataset)
      .catch(() => setDatasetError(true))
      .finally(() => setDatasetLoading(false));
  }, [mode, selectedMapping]);

  // Curated mode: load the verified CBS side.
  useEffect(() => {
    if (mode !== "curated" || !selectedMapping || !includeIsrael) {
      if (mode === "curated") setIsraelData(null);
      return;
    }
    setIsraelLoading(true);
    setIsraelError(false);
    const fetcher =
      selectedMapping.cbsApiType === "index"
        ? fetchCbsPriceIndex(selectedMapping.cbsCode, selectedMapping.cbsValueKind ?? "yoy")
            .then((r) => ({ id: r.code, title: r.title, updated: r.updated, series: r.series, rawUrl: r.rawUrl }))
        : fetchCbsSeries(selectedMapping.cbsCode).then((r) => ({
            id: r.seriesId,
            title: r.title,
            updated: r.updated,
            series: r.series,
            rawUrl: r.rawUrl,
          }));
    fetcher
      .then(setIsraelData)
      .catch(() => setIsraelError(true))
      .finally(() => setIsraelLoading(false));
  }, [mode, selectedMapping, includeIsrael]);

  // Advanced mode: load the Eurostat side for the freely searched dataset.
  useEffect(() => {
    if (mode !== "advanced" || !selected) return;
    setDatasetLoading(true);
    setDatasetError(false);
    setDataset(null);
    setSelectedGeoCodes([]);
    setIncludeEuAggregate(true);
    setIncludeIsrael(true);
    setIsraelData(null);
    setManualCbsId(null);
    setShowCbsPicker(false);

    fetchEurostatDataset(selected.code)
      .then(setDataset)
      .catch(() => setDatasetError(true))
      .finally(() => setDatasetLoading(false));
  }, [mode, selected]);

  // Advanced mode: load the manually attached CBS series, if any.
  useEffect(() => {
    if (mode !== "advanced" || !includeIsrael || !manualCbsId) {
      if (mode === "advanced") setIsraelData(null);
      return;
    }
    setIsraelLoading(true);
    setIsraelError(false);
    fetchCbsSeries(manualCbsId)
      .then((r) => setIsraelData({ id: r.seriesId, title: r.title, updated: r.updated, series: r.series, rawUrl: r.rawUrl }))
      .catch(() => setIsraelError(true))
      .finally(() => setIsraelLoading(false));
  }, [mode, includeIsrael, manualCbsId]);

  const provenanceLines: Provenance[] = useMemo(() => {
    const lines: Provenance[] = [];
    if (dataset) {
      lines.push({ code: dataset.datasetCode, source: "eurostat", updated: dataset.updated, rawUrl: dataset.rawUrl });
    }
    if (israelData) {
      lines.push({ code: israelData.id, source: "cbs", updated: israelData.updated, rawUrl: israelData.rawUrl });
    }
    return lines;
  }, [dataset, israelData]);

  const chartSeries: ChartSeries[] = useMemo(() => {
    if (!dataset) return [];
    const series: ChartSeries[] = [];
    let colorIdx = 0;
    if (includeIsrael && israelData) {
      series.push({
        label: t("provenance.cbs"),
        color: "#34c98f",
        points: israelData.series,
        secondaryAxis: mode === "advanced",
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
  }, [dataset, includeIsrael, israelData, mode, includeEuAggregate, selectedGeoCodes, t]);

  const title = mode === "curated" ? (selectedMapping ? (locale === "he" ? selectedMapping.labelHe : selectedMapping.labelEn) : null) : (selected?.title ?? null);

  return (
    <div>
      <div className="panel">
        <div className="mode-toggle">
          <button
            type="button"
            className="nav-button"
            aria-current={mode === "curated" ? "page" : undefined}
            onClick={() => setMode("curated")}
          >
            {t("mode.curated")}
          </button>
          <button
            type="button"
            className="nav-button"
            aria-current={mode === "advanced" ? "page" : undefined}
            onClick={() => setMode("advanced")}
          >
            {t("mode.advanced")}
          </button>
        </div>

        {mode === "curated" && (
          <>
            <p className="loading-text">{t("mode.curatedNote")}</p>
            <div className="indicator-cards">
              {mappings.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className="indicator-card"
                  aria-current={selectedMapping?.key === m.key}
                  onClick={() => setSelectedMapping(m)}
                >
                  {locale === "he" ? m.labelHe : m.labelEn}
                </button>
              ))}
              {mappings.length === 0 && <p className="loading-text">{t("catalog.loading")}</p>}
            </div>
          </>
        )}

        {mode === "advanced" && (
          <>
            <p className="loading-text">{t("mode.advancedNote")}</p>
            <IndicatorSearch
              toc={toc}
              flatList={flatList}
              selectedCode={selected?.code ?? null}
              onSelect={(code, ttl) => setSelected({ code, title: ttl })}
            />
            {tocError && <p className="error-text">{t("catalog.error")}</p>}
          </>
        )}
      </div>

      {mode === "curated" && !selectedMapping && (
        <div className="panel">
          <p className="loading-text">{t("catalog.selectDataset")}</p>
        </div>
      )}
      {mode === "advanced" && !selected && (
        <div className="panel">
          <p className="loading-text">{t("catalog.selectDataset")}</p>
        </div>
      )}

      {((mode === "curated" && selectedMapping) || (mode === "advanced" && selected)) && (
        <div className="panel">
          {title && <h2 className="panel-title">{title}</h2>}
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

              {!dataset.hasIsrael && includeIsrael && mode === "advanced" && (
                <p className="loading-text" style={{ marginBlockEnd: "0.5rem" }}>
                  {t("nodata.noIsrael")}
                </p>
              )}

              {includeIsrael && mode === "advanced" && (
                <div style={{ marginBlockEnd: "1rem" }}>
                  {manualCbsId && !showCbsPicker && (
                    <div className="selector-row">
                      <span className="loading-text">
                        {israelLoading ? t("catalog.loading") : (israelData?.title ?? manualCbsId)}
                        {" — "}
                        {t("cbsPicker.manual")}
                      </span>
                      <button type="button" className="link-button" onClick={() => setShowCbsPicker(true)}>
                        {t("cbsPicker.change")}
                      </button>
                    </div>
                  )}
                  {israelError && <NoDataNotice reason="loadFailed" />}
                  {(!manualCbsId || showCbsPicker) && (
                    <CbsSeriesPicker
                      onSelect={(id) => {
                        setManualCbsId(id);
                        setShowCbsPicker(false);
                        setIsraelData((prev) => (prev && prev.id === id ? prev : null));
                      }}
                    />
                  )}
                  {!manualCbsId && !showCbsPicker && <NoDataNotice reason="noMapping" />}
                </div>
              )}

              {includeIsrael && mode === "curated" && israelLoading && (
                <p className="loading-text">{t("catalog.loading")}</p>
              )}
              {includeIsrael && mode === "curated" && israelError && <NoDataNotice reason="loadFailed" />}

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
                  israelPoints={israelData?.series ?? null}
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
