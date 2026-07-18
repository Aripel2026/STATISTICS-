import { useI18n } from "../i18n";

interface NoDataNoticeProps {
  reason: "noMapping" | "missingValue" | "noIsrael" | "loadFailed";
}

export default function NoDataNotice({ reason }: NoDataNoticeProps) {
  const { t } = useI18n();
  return (
    <div className="no-data-notice" role="status">
      <strong>{t("nodata.title")}</strong>
      <span>{t(`nodata.${reason}`)}</span>
    </div>
  );
}
