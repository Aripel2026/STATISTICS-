import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { searchFlatIndicators } from "../lib/flattenToc";
import type { FlatIndicator, TocNode } from "../lib/types";
import CatalogTree from "./CatalogTree";

interface IndicatorSearchProps {
  toc: TocNode | null;
  flatList: FlatIndicator[];
  selectedCode: string | null;
  onSelect: (code: string, title: string) => void;
}

export default function IndicatorSearch({ toc, flatList, selectedCode, onSelect }: IndicatorSearchProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [browseOpen, setBrowseOpen] = useState(false);

  const results = useMemo(() => searchFlatIndicators(flatList, query), [flatList, query]);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search.placeholder")}
        className="search-input"
      />
      {query.trim().length > 0 && (
        <ul className="search-results">
          {results.length === 0 && <li className="loading-text">{t("search.noResults")}</li>}
          {results.map((r, i) => (
            <li
              key={`${i}-${r.code}`}
              className="tree-leaf search-result-item"
              aria-current={selectedCode === r.code}
              onClick={() => {
                onSelect(r.code, r.title);
                setQuery("");
              }}
            >
              <div>{r.title}</div>
              <div className="search-result-meta">
                {r.breadcrumb.join(" › ")} <code>{r.code}</code>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="link-button" onClick={() => setBrowseOpen((v) => !v)}>
        {browseOpen ? t("search.hideBrowse") : t("search.showBrowse")}
      </button>
      {browseOpen && toc && (
        <div style={{ marginBlockStart: "0.75rem" }}>
          <CatalogTree node={toc} selectedCode={selectedCode} onSelectDataset={onSelect} />
        </div>
      )}
    </div>
  );
}
