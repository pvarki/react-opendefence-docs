import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

interface PageFooterProps {
  collection: string;
  clientId?: string;
}

/**
 * Compact in-page footer shown below every content page in a guide.
 * Renders the guide's lead blurb and, when defined, a product/client blurb
 * (e.g. what ATAK is, its flavors, etc.).
 */
export function PageFooter({ collection, clientId }: PageFooterProps) {
  const { t } = useTranslation();
  const slug = collection.replace(/^guides\//, "");
  const guideKey = `guideFooter.${slug}.lead`;
  const clientKey = clientId ? `clientFooter.${clientId}.lead` : undefined;

  const hasGuide = i18n.exists(guideKey);
  const hasClient = !!clientKey && i18n.exists(clientKey);

  if (!hasGuide && !hasClient) return null;

  return (
    <footer className="mt-8 border-t border-border pt-6 text-sm leading-relaxed text-muted-foreground">
      {hasClient && (
        <p className={hasGuide ? "mb-3" : undefined}>{t(clientKey!)}</p>
      )}
      {hasGuide && <p>{t(guideKey)}</p>}
    </footer>
  );
}
