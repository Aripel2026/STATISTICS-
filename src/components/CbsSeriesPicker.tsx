import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { searchCbsSeries } from "../lib/api";
import type { CbsIndexEntry } from "../lib/types";

interface CbsSeriesPickerProps {
  onSelect: (seriesId: string, title: string) => void;
}

export default function CbsSeriesPicker({ onSelect }: CbsSeriesPickerProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CbsIndexEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      setLoading(true);
      setError(false);
      searchCbsSeries(query)
        .then(setResults)
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="cbs-picker">
      <p className="cbs-picker-note">{t("cbsPicker.note")}</p>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("cbsPicker.placeholder")}
        className="search-input"
      />
      {loading && <p className="loading-text">{t("catalog.loading")}</p>}
      {error && <p className="error-text">{t("cbs.error")}</p>}
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((r) => (
            <li
              key={r.seriesId}
              className="tree-leaf search-result-item"
              onClick={() => {
                onSelect(r.seriesId, r.title);
                setQuery("");
                setResults([]);
              }}
            >
              <div>{r.title}</div>
              <div className="search-result-meta">
                {r.topLevelTitle} <code>{r.seriesId}</code>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!loading && query.trim().length >= 2 && results.length === 0 && !error && (
        <p className="loading-text">{t("search.noResults")}</p>
      )}
    </div>
  );
}
