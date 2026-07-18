import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { EU27_CODES } from "../lib/euCountries";
import type { EurostatDatasetResponse } from "../lib/types";

interface CountrySelectorProps {
  dataset: EurostatDatasetResponse;
  selectedGeoCodes: string[];
  onChangeGeoCodes: (codes: string[]) => void;
  includeEuAggregate: boolean;
  onToggleEuAggregate: (value: boolean) => void;
  includeIsrael: boolean;
  onToggleIsrael: (value: boolean) => void;
}

export default function CountrySelector({
  dataset,
  selectedGeoCodes,
  onChangeGeoCodes,
  includeEuAggregate,
  onToggleEuAggregate,
  includeIsrael,
  onToggleIsrael,
}: CountrySelectorProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const availableMemberStates = EU27_CODES.filter((c) => dataset.availableGeoCodes.includes(c));

  const visibleStates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableMemberStates;
    return availableMemberStates.filter((code) => (dataset.geoLabels[code] ?? code).toLowerCase().includes(q));
  }, [availableMemberStates, dataset.geoLabels, query]);

  function toggleCountry(code: string) {
    if (selectedGeoCodes.includes(code)) {
      onChangeGeoCodes(selectedGeoCodes.filter((c) => c !== code));
    } else {
      onChangeGeoCodes([...selectedGeoCodes, code]);
    }
  }

  return (
    <div className="country-selector">
      <div className="country-selector-actions">
        <label className="pill-checkbox pill-checkbox-il">
          <input type="checkbox" checked={includeIsrael} onChange={(e) => onToggleIsrael(e.target.checked)} />
          {t("provenance.cbs")}
        </label>
        {dataset.euAggregateCode && (
          <label className="pill-checkbox pill-checkbox-eu">
            <input
              type="checkbox"
              checked={includeEuAggregate}
              onChange={(e) => onToggleEuAggregate(e.target.checked)}
            />
            {dataset.geoLabels[dataset.euAggregateCode] ?? dataset.euAggregateCode}
          </label>
        )}
        <button type="button" className="link-button" onClick={() => setExpanded((v) => !v)}>
          {expanded
            ? t("countries.hide")
            : selectedGeoCodes.length > 0
              ? `${t("countries.addSpecific")} (${selectedGeoCodes.length} ${t("countries.selectedCount")})`
              : t("countries.addSpecific")}
        </button>
      </div>

      {expanded && (
        <div className="country-panel">
          <div className="country-panel-toolbar">
            <input
              type="text"
              className="search-input country-search"
              placeholder={t("countries.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" className="link-button" onClick={() => onChangeGeoCodes(availableMemberStates)}>
              {t("countries.selectAll")}
            </button>
            <button type="button" className="link-button" onClick={() => onChangeGeoCodes([])}>
              {t("countries.clear")}
            </button>
          </div>
          <div className="country-grid">
            {visibleStates.map((code) => (
              <label key={code} className="pill-checkbox pill-checkbox-compact">
                <input
                  type="checkbox"
                  checked={selectedGeoCodes.includes(code)}
                  onChange={() => toggleCountry(code)}
                />
                {dataset.geoLabels[code] ?? code}
              </label>
            ))}
            {visibleStates.length === 0 && <p className="loading-text">{t("search.noResults")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
