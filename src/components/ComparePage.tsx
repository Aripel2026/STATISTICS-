import { useI18n } from "../i18n";

export default function ComparePage() {
  const { t } = useI18n();
  return (
    <div className="panel">
      <h2 className="panel-title">{t("compare.title")}</h2>
      <p className="loading-text">{t("catalog.selectDataset")}</p>
    </div>
  );
}
