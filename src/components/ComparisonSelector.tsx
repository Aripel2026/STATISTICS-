import { useI18n } from "../i18n";

export type ComparisonMode = "single" | "aggregate" | "all27";

interface ComparisonSelectorProps {
  mode: ComparisonMode;
  onModeChange: (mode: ComparisonMode) => void;
  countryCode: string | null;
  onCountryChange: (code: string) => void;
  countryOptions: { code: string; label: string }[];
}

export default function ComparisonSelector({
  mode,
  onModeChange,
  countryCode,
  onCountryChange,
  countryOptions,
}: ComparisonSelectorProps) {
  const { t } = useI18n();

  return (
    <div className="selector-row">
      <button
        type="button"
        className="nav-button"
        aria-current={mode === "single" ? "page" : undefined}
        onClick={() => onModeChange("single")}
      >
        {t("compare.mode.single")}
      </button>
      <button
        type="button"
        className="nav-button"
        aria-current={mode === "aggregate" ? "page" : undefined}
        onClick={() => onModeChange("aggregate")}
      >
        {t("compare.mode.aggregate")}
      </button>
      <button
        type="button"
        className="nav-button"
        aria-current={mode === "all27" ? "page" : undefined}
        onClick={() => onModeChange("all27")}
      >
        {t("compare.mode.all27")}
      </button>

      {mode === "single" && (
        <select value={countryCode ?? ""} onChange={(e) => onCountryChange(e.target.value)}>
          {countryOptions.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
