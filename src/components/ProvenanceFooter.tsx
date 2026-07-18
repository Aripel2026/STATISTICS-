import { useI18n } from "../i18n";
import type { Provenance } from "../lib/types";

interface ProvenanceFooterProps {
  lines: Provenance[];
}

export default function ProvenanceFooter({ lines }: ProvenanceFooterProps) {
  const { t } = useI18n();
  return (
    <div className="provenance-footer">
      {lines.map((p) => (
        <div className="provenance-line" key={`${p.source}-${p.code}`}>
          <span>{t(`provenance.${p.source}`)}</span>
          <span>
            {t("provenance.code")}: <code>{p.code}</code>
          </span>
          <span>
            {t("provenance.updated")}: {p.updated ?? "—"}
          </span>
          <a href={p.rawUrl} target="_blank" rel="noreferrer">
            {t("provenance.rawUrl")}
          </a>
        </div>
      ))}
    </div>
  );
}
