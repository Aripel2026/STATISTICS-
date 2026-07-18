import { useI18n } from "../i18n";

export default function CbsBrowser() {
  const { t } = useI18n();
  return (
    <div className="panel">
      <h2 className="panel-title">{t("cbs.title")}</h2>
      <p className="loading-text">{t("cbs.loading")}</p>
    </div>
  );
}
