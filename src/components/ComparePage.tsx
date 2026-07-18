import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import {
  fetchCbsSeries,
  fetchEurostatDataset,
  fetchIndicatorMappings,
  fetchToc,
} from "../lib/api";
import type {
  CbsSeriesResponse,
  EurostatDatasetResponse,
  IndicatorMapping,
  Provenance,
  TocNode,
} from "../lib/types";
import CatalogTree from "./CatalogTree";
import ComparisonSelector, { type ComparisonMode } from "./ComparisonSelector";
import IndicatorChart, { type ChartSeries } from "./IndicatorChart";
import MapView from "./MapView";
import NoDataNotice from "./NoDataNotice";
import ProvenanceFooter from "./ProvenanceFooter";

export default function ComparePage() {
  const { t } = useI18n();
  const [toc, setToc] = useState<TocNode | null>(null);
  const [selected, setSelected] = useState<{ code: string; title: string } | null>(null);
  const [dataset, setDataset] = useState<EurostatDatasetResponse | null>(null);
  const [datasetError, setDatasetError] = useState(false);
  const [datasetLoading, setDatasetLoading] = useState(false);

  const [mappings, setMappings] = useState<IndicatorMapping[]>([]);
  const [cbsSeries, setCbsSeries] = useState<CbsSeriesResponse | null>(null);
  const [cbsLoading, setCbsLoading] = useState(false);
  const [cbsError, setCbsError] = useState(false);

  const [mode, setMode] = useState<ComparisonMode>("aggregate");
  const [countryCode, setCountryCode] = useState<string | null>(null);

  useEffect(() => {
    fetchToc().then(setToc).catch(() => {});
    fetchIndicatorMappings().then(setMappings).catch(() => setMappings([]));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setDatasetLoading(true);
    setDatasetError(false);
    setDataset(null);
    setCbsSeries(null);
    setCbsError(false);
    fetchEurostatDataset(selected.code)
      .then((d) => {
        setDataset(d);
        setCountryCode((prev) => prev ?? d.availableGeoCodes.find((c) => c !== d.euAggregateCode) ?? null);
      })
      .catch(() => setDatasetError(true))
      .finally(() => setDatasetLoading(false));
  }, [selected]);

  const mapping = useMemo(
    () => (selected ? mappings.find((m) => m.eurostatDatasetCode === selected.code) : undefined),
    [mappings, selected],
  );

  useEffect(() => {
    if (!mapping) {
      setCbsSeries(null);
      return;
    }
    setCbsLoading(true);
    setCbsError(false);
    fetchCbsSeries(mapping.cbsSeriesId)
      .then(setCbsSeries)
      .catch(() => setCbsError(true))
      .finally(() => setCbsLoading(false));
  }, [mapping]);

  const countryOptions = useMemo(() => {
    if (!dataset) return [];
    return dataset.availableGeoCodes
      .filter((c) => c !== dataset.euAggregateCode)
      .map((c) => ({ code: c, label: dataset.geoLabels[c] ?? c }));
  }, [dataset]);

  const provenanceLines: Provenance[] = useMemo(() => {
    const lines: Provenance[] = [];
    if (dataset) {
      lines.push({ code: dataset.datasetCode, source: "eurostat", updated: dataset.updated, rawUrl: dataset.rawUrl });
    }
    if (cbsSeries) {
      lines.push({ code: cbsSeries.seriesId, source: "cbs", updated: cbsSeries.updated, rawUrl: cbsSeries.rawUrl });
    }
    return lines;
  }, [dataset, cbsSeries]);

  return (
    <div>
      <div className="panel">
        <h2 className="panel-title">{t("compare.title")}</h2>
        {!toc && <p className="loading-text">{t("catalog.loading")}</p>}
        {toc && (
          <CatalogTree
            node={toc}
            selectedCode={selected?.code ?? null}
            onSelectDataset={(code, title) => setSelected({ code, title })}
          />
        )}
      </div>

      {!selected && (
        <div className="panel">
          <p className="loading-text">{t("catalog.selectDataset")}</p>
        </div>
      )}

      {selected && (
        <div className="panel">
          {datasetLoading && <p className="loading-text">{t("catalog.loading")}</p>}
          {datasetError && <NoDataNotice reason="loadFailed" />}
          {dataset && (
            <>
              <ComparisonSelector
                mode={mode}
                onModeChange={setMode}
                countryCode={countryCode}
                onCountryChange={setCountryCode}
                countryOptions={countryOptions}
              />

              {!mapping && <NoDataNotice reason="noMapping" />}
              {mapping && cbsLoading && <p className="loading-text">{t("catalog.loading")}</p>}
              {mapping && cbsError && <NoDataNotice reason="loadFailed" />}

              {mode !== "all27" && (
                <IndicatorChart
                  title={dataset.title}
                  seriesList={(() => {
                    const series: ChartSeries[] = [];
                    const euCode = mode === "aggregate" ? dataset.euAggregateCode : countryCode;
                    if (euCode && dataset.series[euCode]) {
                      series.push({
                        label: dataset.geoLabels[euCode] ?? euCode,
                        color: "#ffb454",
                        points: dataset.series[euCode],
                      });
                    }
                    if (cbsSeries) {
                      series.push({
                        label: t("provenance.cbs"),
                        color: "#2fb37c",
                        points: cbsSeries.series,
                      });
                    }
                    return series;
                  })()}
                />
              )}

              {mode === "all27" && <MapView dataset={dataset} israelPoints={cbsSeries?.series ?? null} />}

              {provenanceLines.length > 0 && <ProvenanceFooter lines={provenanceLines} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
