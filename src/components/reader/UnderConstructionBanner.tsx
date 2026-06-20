import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";

/**
 * Non-blocking notice shown above content that hasn't met the quality bar yet.
 * Render it when isPageUnderConstruction / isCoverUnderConstruction is true.
 */
export function UnderConstructionBanner() {
  const { t } = useTranslation();
  return (
    <div
      role="note"
      className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning md:mb-6"
    >
      <Construction className="mt-0.5 size-4 shrink-0" />
      <p>
        <span className="font-semibold">
          {t("reader.underConstruction.title")}
        </span>{" "}
        {t("reader.underConstruction.body")}
      </p>
    </div>
  );
}
