import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { fetchCbsLeafSeries, fetchCbsSeries, fetchCbsTopLevel } from "../lib/api";
import type { CbsCatalogCategory, CbsLeafSeries, CbsSeriesResponse } from "../lib/types";
import IndicatorChart, { type ChartSeries } from "./IndicatorChart";
import NoDataNotice from "./NoDataNotice";
import ProvenanceFooter from "./ProvenanceFooter";

export default function CbsBrowser() {
  const { t, locale } = useI18n();
  const [categories, setCategories] = useState<CbsCatalogCategory[] | null>(null);
  const [categoriesError, setCategoriesError] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [leafSeries, setLeafSeries] = useState<CbsLeafSeries[]>([]);
  const [leafPage, setLeafPage] = useState(1);
  const [leafLoading, setLeafLoading] = useState(false);

  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [seriesData, setSeriesData] = useState<CbsSeriesResponse | null>(null);
  const [seriesError, setSeriesError] = useState(false);
  const [seriesLoading, setSeriesLoading] = useState(false);

  const lang = locale === "he" ? "he" : "en";

  useEffect(() => {
    setCategories(null);
    setCategoriesError(false);
    fetchCbsTopLevel(lang)
      .then(setCategories)
      .catch(() => setCategoriesError(true));
  }, [lang]);

  function openCategoryAndLoad(id: string) {
    setOpenCategory(id);
    setLeafSeries([]);
    setLeafPage(1);
    loadLeafPage(id, 1);
  }

  function loadLeafPage(id: string, page: number) {
    setLeafLoading(true);
    fetchCbsLeafSeries(id, page, lang)
      .then((rows) => {
        setLeafSeries((prev) => (page === 1 ? rows : [...prev, ...rows]));
        setLeafPage(page);
      })
      .catch(() => setLeafSeries([]))
      .finally(() => setLeafLoading(false));
  }

  useEffect(() => {
    if (!selectedSeriesId) return;
    setSeriesLoading(true);
    setSeriesError(false);
    setSeriesData(null);
    fetchCbsSeries(selectedSeriesId, lang)
      .then(setSeriesData)
      .catch(() => setSeriesError(true))
      .finally(() => setSeriesLoading(false));
  }, [selectedSeriesId, lang]);

  return (
    <div>
      <div className="panel">
        <h2 className="panel-title">{t("cbs.title")}</h2>
        <p className="loading-text">{t("cbs.note")}</p>
        {categoriesError && <p className="error-text">{t("cbs.error")}</p>}
        {!categories && !categoriesError && <p className="loading-text">{t("cbs.loading")}</p>}
        {categories && (
          <ul className="tree-list" style={{ paddingInlineStart: 0 }}>
            {categories.map((cat) => (
              <li className="tree-node" key={cat.id}>
                <div className="tree-node-label" onClick={() => openCategoryAndLoad(cat.id)}>
                  <span>{openCategory === cat.id ? "▾" : "▸"}</span>
                  <span>{cat.title}</span>
                </div>
                {openCategory === cat.id && (
                  <ul className="tree-list">
                    {leafSeries.map((s, i) => (
                      <li
                        key={`${i}-${s.seriesId}`}
                        className="tree-leaf"
                        aria-current={selectedSeriesId === s.seriesId}
                        onClick={() => setSelectedSeriesId(s.seriesId)}
                      >
                        {s.title} <code style={{ opacity: 0.6 }}>{s.seriesId}</code>
                      </li>
                    ))}
                    {leafLoading && <li className="loading-text">{t("cbs.loading")}</li>}
                    {!leafLoading && leafSeries.length > 0 && leafSeries.length % 100 === 0 && (
                      <li>
                        <button type="button" onClick={() => loadLeafPage(cat.id, leafPage + 1)}>
                          +
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedSeriesId && (
        <div className="panel">
          {seriesLoading && <p className="loading-text">{t("cbs.loading")}</p>}
          {seriesError && <NoDataNotice reason="loadFailed" />}
          {seriesData && (
            <>
              <IndicatorChart
                title={seriesData.title ?? seriesData.seriesId}
                seriesList={
                  [
                    {
                      label: seriesData.title ?? seriesData.seriesId,
                      color: "#2fb37c",
                      points: seriesData.series,
                    },
                  ] satisfies ChartSeries[]
                }
              />
              <ProvenanceFooter
                lines={[
                  {
                    code: seriesData.seriesId,
                    source: "cbs",
                    updated: seriesData.updated,
                    rawUrl: seriesData.rawUrl,
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
