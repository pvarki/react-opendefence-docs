import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";

/**
 * Non-blocking notice shown above content that hasn't met the quality bar yet.
 * Render it when isPageUnderConstruction / isCoverUnderConstruction is true,
 * or when the page carries the draft marker (PageDoc.underDevelopment).
 */
export function UnderConstructionBanner() {
  const { t } = useTranslation();
  return (
    <div
      role="note"
      className="mb-4 flex items-start gap-2.5 rounded-lg border border-l-3 border-border border-l-warning bg-muted/40 px-4 py-3 text-sm text-muted-foreground md:mb-6"
    >
      <Construction className="mt-0.5 size-4 shrink-0 text-warning" />
      <p>
        <span className="font-semibold text-foreground">
          {t("reader.underConstruction.title")}
        </span>{" "}
        {t("reader.underConstruction.body")}
      </p>
    </div>
  );
}
