import { Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DEFAULT_LOCALE, LOCALES } from "@shared/content-schema";
import { AgentFriendlyNote } from "@/components/shell/AgentFriendlyNote";
import {
  LOCALE_LABELS,
  useLocaleSwitch,
} from "@/components/shell/LocaleSwitcher";
import { SectionLabel } from "@/components/ui/section-label";
import { CONTACT_EMAIL, openIntroModal } from "@/lib/introModal";
import { PAGE_FRAME } from "@/lib/pageFrame";
import { SHELF_LABEL_KEYS, SHELF_STOPS } from "@/lib/shelfNav";
import { cn } from "@/lib/utils";

const COPYRIGHT_LINES = [
  "Deploy App & this site: © OpenDefence",
  "FDF images: © Finnish Defence Forces",
  "TAK: © TAK Product Center, a U.S. Government organization",
  "Matrix: © The Matrix.org Foundation",
  "MediaMTX: © aler9",
  "CryptPad: © XWiki SAS",
];

// Legal names and address are not translated.
const FOUNDATION = {
  project: "The OpenDefence Project",
  name: "Defence Innovation Foundation sr",
  localName: "FI: Puolustusinnovaatiosäätiö sr",
  businessId: "3628671-7",
  address: "Annankatu 19, 00120 Helsinki",
};

const LINK =
  "inline-block py-1 text-muted-foreground transition-colors hover:text-foreground underline-offset-2 hover:underline [overflow-wrap:anywhere]";

function BuildStamp() {
  const { t } = useTranslation();
  return (
    <p className="text-[11px] text-muted-foreground/70">
      {t("docsBuild", { date: __BUILD_DATE__, commit: __BUILD_COMMIT__ })}
    </p>
  );
}

function AboutLink() {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={openIntroModal} className={LINK}>
      {t("intro.revisit")}
    </button>
  );
}

export function SiteFooter({
  compact = false,
  agentExample,
}: {
  compact?: boolean;
  agentExample?: string;
}) {
  const { t } = useTranslation();
  const params = useParams({ strict: false });
  const locale = params.locale ?? DEFAULT_LOCALE;
  const { current, switchTo } = useLocaleSwitch();

  if (compact) {
    return (
      <footer
        data-site-footer
        className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-4 text-xs"
      >
        <AboutLink />
        <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
          {CONTACT_EMAIL}
        </a>
        <span className="ml-auto">
          <BuildStamp />
        </span>
      </footer>
    );
  }

  return (
    <footer
      data-site-footer
      className="mt-auto border-t border-border bg-card text-sm"
    >
      <div className={cn(PAGE_FRAME, "py-8 md:py-10")}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
          <div>
            <SectionLabel className="pb-2">{t("siteFooter.docs")}</SectionLabel>
            <ul className="space-y-1.5">
              {SHELF_STOPS.map((stop) => (
                <li key={stop.id}>
                  <Link
                    to={
                      (stop.path
                        ? `/$locale/${stop.path}`
                        : "/$locale") as string
                    }
                    params={{ locale }}
                    className={LINK}
                  >
                    {t(SHELF_LABEL_KEYS[stop.id])}
                  </Link>
                </li>
              ))}
              <li>
                <AboutLink />
              </li>
            </ul>
          </div>

          <div>
            <SectionLabel className="pb-2">
              {t("siteFooter.organization")}
            </SectionLabel>
            <address className="space-y-0.5 text-xs leading-relaxed text-muted-foreground not-italic">
              <p className="text-foreground">{FOUNDATION.project}</p>
              <p>{FOUNDATION.name}</p>
              <p>{FOUNDATION.localName}</p>
              <p>
                {t("siteFooter.businessId")} {FOUNDATION.businessId}
              </p>
              <p>{FOUNDATION.address}</p>
              <p className="pt-1">
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-block py-1 text-primary underline-offset-2 [overflow-wrap:anywhere] hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
            </address>
          </div>

          <div>
            <SectionLabel className="pb-2">
              {t("siteFooter.copyright")}
            </SectionLabel>
            <ul className="space-y-0.5 text-xs leading-relaxed text-muted-foreground">
              {COPYRIGHT_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div>
            <SectionLabel className="pb-2">{t("common.language")}</SectionLabel>
            <ul className="space-y-1.5">
              {LOCALES.map((l) => (
                <li key={l}>
                  <button
                    type="button"
                    lang={l}
                    onClick={() => switchTo(l)}
                    aria-current={l === current ? "true" : undefined}
                    className={cn(
                      LINK,
                      l === current && "font-medium text-foreground",
                    )}
                  >
                    {LOCALE_LABELS[l]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {agentExample && <AgentFriendlyNote example={agentExample} />}
        <div className="mt-6">
          <BuildStamp />
        </div>
      </div>
    </footer>
  );
}
