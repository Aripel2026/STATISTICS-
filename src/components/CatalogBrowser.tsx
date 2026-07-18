import { useI18n } from "../i18n";

export default function CatalogBrowser() {
  const { t } = useI18n();
  return (
    <div className="panel">
      <h2 className="panel-title">{t("catalog.title")}</h2>
      <p className="loading-text">{t("catalog.loading")}</p>
    </div>
  );
}
