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

  const [mappings, setMappings] = useState<IndicatorMapping[]>([]);
  const [selectedMapping, setSelectedMapping] = useState<IndicatorMapping | null>(null);

  const [toc, setToc] = useState<TocNode | null>(null);
  const [tocError, setTocError] = useState(false);
  const flatList = useMemo(() => (toc ? flattenToc(toc) : []), [toc]);
  const [selected, setSelected] = useState<{ code: string; title: string } | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [dataset, setDataset] = useState<EurostatDatasetResponse | null>(null);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [datasetError, setDatasetError] = useState(false);

  const [selectedGeoCodes, setSelectedGeoCodes] = useState<string[]>([]);
  const [includeEuAggregate, setIncludeEuAggregate] = useState(true);
  const [includeIsrael, setIncludeIsrael] = useState(true);

  const [israelData, setIsraelData] = useState<IsraelData | null>(null);
  const [israelLoading, setIsraelLoading] = useState(false);
  const [israelError, setIsraelError] = useState(false);

  // Advanced (manual CBS attach) only: no curated/verified match exists.
  const [manualCbsId, setManualCbsId] = useState<string | null>(null);
  const [showCbsPicker, setShowCbsPicker] = useState(false);
  const [manuallyPicked, setManuallyPicked] = useState(false);

  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  useEffect(() => {
    fetchIndicatorMappings().then(setMappings).catch(() => setMappings([]));
    fetchToc().then(setToc).catch(() => setTocError(true));
  }, []);

  function pickCurated(mapping: IndicatorMapping) {
    setAdvancedOpen(false);
    setSelected(null);
    setManualCbsId(null);
    setManuallyPicked(false);
    setSelectedMapping(mapping);

    setDatasetLoading(true);
    setDatasetError(false);
    setDataset(null);
    setSelectedGeoCodes([]);
    setIncludeEuAggregate(true);
    setIncludeIsrael(true);

    fetchEurostatDataset(mapping.eurostatDatasetCode, mapping.euFilterOverrides)
      .then(setDataset)
      .catch(() => setDatasetError(true))
      .finally(() => setDatasetLoading(false));

    setIsraelLoading(true);
    setIsraelError(false);
    const fetcher =
      mapping.cbsApiType === "index"
        ? fetchCbsPriceIndex(mapping.cbsCode, mapping.cbsValueKind ?? "yoy").then((r) => ({
            id: r.code,
            title: r.title,
            updated: r.updated,
            series: r.series,
            rawUrl: r.rawUrl,
          }))
        : fetchCbsSeries(mapping.cbsCode).then((r) => ({
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
  }

  function pickAdvanced(code: string, title: string) {
    setSelectedMapping(null);
    setSelected({ code, title });
    setManualCbsId(null);
    setManuallyPicked(false);
    setShowCbsPicker(false);
    setIsraelData(null);

    setDatasetLoading(true);
    setDatasetError(false);
    setDataset(null);
    setSelectedGeoCodes([]);
    setIncludeEuAggregate(true);
    setIncludeIsrael(true);

    fetchEurostatDataset(code)
      .then(setDataset)
      .catch(() => setDatasetError(true))
      .finally(() => setDatasetLoading(false));
  }

  // Advanced only: load the manually attached CBS series, if any.
  useEffect(() => {
    if (!selected || !includeIsrael || !manualCbsId) return;
    setIsraelLoading(true);
    setIsraelError(false);
    fetchCbsSeries(manualCbsId)
      .then((r) => setIsraelData({ id: r.seriesId, title: r.title, updated: r.updated, series: r.series, rawUrl: r.rawUrl }))
      .catch(() => setIsraelError(true))
      .finally(() => setIsraelLoading(false));
  }, [selected, includeIsrael, manualCbsId]);

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
        secondaryAxis: manuallyPicked,
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
  }, [dataset, includeIsrael, israelData, manuallyPicked, includeEuAggregate, selectedGeoCodes, t]);

  const title = selectedMapping ? (locale === "he" ? selectedMapping.labelHe : selectedMapping.labelEn) : selected?.title ?? null;
  const isAdvanced = !selectedMapping && selected !== null;

  return (
    <div>
      <div className="panel">
        <p className="loading-text">{t("mode.curatedNote")}</p>
        <div className="indicator-cards">
          {mappings.map((m) => (
            <button
              key={m.key}
              type="button"
              className="indicator-card"
              aria-current={selectedMapping?.key === m.key}
              onClick={() => pickCurated(m)}
            >
              {locale === "he" ? m.labelHe : m.labelEn}
            </button>
          ))}
          {mappings.length === 0 && <p className="loading-text">{t("catalog.loading")}</p>}
        </div>

        {!advancedOpen && (
          <button type="button" className="link-button" onClick={() => setAdvancedOpen(true)}>
            {t("mode.advanced")}
          </button>
        )}
        {advancedOpen && (
          <div style={{ marginBlockStart: "1rem" }}>
            <p className="loading-text">{t("mode.advancedNote")}</p>
            <IndicatorSearch
              toc={toc}
              flatList={flatList}
              selectedCode={selected?.code ?? null}
              onSelect={pickAdvanced}
            />
            {tocError && <p className="error-text">{t("catalog.error")}</p>}
          </div>
        )}
      </div>

      {!selectedMapping && !selected && (
        <div className="panel">
          <p className="loading-text">{t("catalog.selectDataset")}</p>
        </div>
      )}

      {(selectedMapping || selected) && (
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

              {!dataset.hasIsrael && includeIsrael && isAdvanced && (
                <p className="loading-text" style={{ marginBlockEnd: "0.5rem" }}>
                  {t("nodata.noIsrael")}
                </p>
              )}

              {includeIsrael && isAdvanced && (
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
                        setManuallyPicked(true);
                        setShowCbsPicker(false);
                        setIsraelData((prev) => (prev && prev.id === id ? prev : null));
                      }}
                    />
                  )}
                  {!manualCbsId && !showCbsPicker && <NoDataNotice reason="noMapping" />}
                </div>
              )}

              {includeIsrael && !isAdvanced && israelLoading && (
                <p className="loading-text">{t("catalog.loading")}</p>
              )}
              {includeIsrael && !isAdvanced && israelError && <NoDataNotice reason="loadFailed" />}

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
