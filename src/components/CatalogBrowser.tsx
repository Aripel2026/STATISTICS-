import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { fetchEurostatDataset, fetchToc } from "../lib/api";
import type { EurostatDatasetResponse, TocNode } from "../lib/types";
import CatalogTree from "./CatalogTree";
import IndicatorChart, { type ChartSeries } from "./IndicatorChart";
import NoDataNotice from "./NoDataNotice";
import ProvenanceFooter from "./ProvenanceFooter";

export default function CatalogBrowser() {
  const { t } = useI18n();
  const [toc, setToc] = useState<TocNode | null>(null);
  const [tocError, setTocError] = useState(false);
  const [selected, setSelected] = useState<{ code: string; title: string } | null>(null);
  const [dataset, setDataset] = useState<EurostatDatasetResponse | null>(null);
  const [datasetError, setDatasetError] = useState(false);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [geoCode, setGeoCode] = useState<string | null>(null);

  useEffect(() => {
    fetchToc()
      .then(setToc)
      .catch(() => setTocError(true));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setDatasetLoading(true);
    setDatasetError(false);
    setDataset(null);
    fetchEurostatDataset(selected.code)
      .then((d) => {
        setDataset(d);
        setGeoCode(d.euAggregateCode ?? d.availableGeoCodes[0] ?? null);
      })
      .catch(() => setDatasetError(true))
      .finally(() => setDatasetLoading(false));
  }, [selected]);

  return (
    <div>
      <div className="panel">
        <h2 className="panel-title">{t("catalog.title")}</h2>
        {tocError && <p className="error-text">{t("catalog.error")}</p>}
        {!toc && !tocError && <p className="loading-text">{t("catalog.loading")}</p>}
        {toc && (
          <CatalogTree
            node={toc}
            selectedCode={selected?.code ?? null}
            onSelectDataset={(code, title) => setSelected({ code, title })}
          />
        )}
      </div>

      {selected && (
        <div className="panel">
          {datasetLoading && <p className="loading-text">{t("catalog.loading")}</p>}
          {datasetError && <NoDataNotice reason="loadFailed" />}
          {dataset && (
            <>
              <div className="selector-row">
                <label htmlFor="geo-select">{t("compare.selectCountry")}</label>
                <select
                  id="geo-select"
                  value={geoCode ?? ""}
                  onChange={(e) => setGeoCode(e.target.value)}
                >
                  {dataset.availableGeoCodes.map((code) => (
                    <option key={code} value={code}>
                      {dataset.geoLabels[code] ?? code}
                    </option>
                  ))}
                </select>
              </div>

              {!dataset.hasIsrael && <NoDataNotice reason="noIsrael" />}

              {geoCode && dataset.series[geoCode] && (
                <IndicatorChart
                  title={dataset.title}
                  seriesList={
                    [
                      {
                        label: dataset.geoLabels[geoCode] ?? geoCode,
                        color: "#4f9dff",
                        points: dataset.series[geoCode],
                      },
                    ] satisfies ChartSeries[]
                  }
                />
              )}

              <ProvenanceFooter
                lines={[
                  {
                    code: dataset.datasetCode,
                    source: "eurostat",
                    updated: dataset.updated,
                    rawUrl: dataset.rawUrl,
                  },
                ]}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
