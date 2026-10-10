import { Fragment, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  ChevronDown,
  Code2,
  Info,
  MonitorPlay,
  Smartphone,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BookCard } from "@/components/shell/BookCard";
import { OrientationModal } from "@/components/shell/OrientationModal";
import { markOrientationSeen, type TrackKey } from "@/lib/orientationFlows";
import { PwaInstallPrompt } from "@/components/shell/PwaInstallPrompt";
import { ShelfIndicator } from "@/components/shell/ShelfIndicator";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { withBase } from "@/lib/base";
import { CONTACT_EMAIL } from "@/lib/introModal";
import { PAGE_FRAME } from "@/lib/pageFrame";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$locale/")({
  component: HomePage,
});

interface HomeCard {
  /** Internal route target (literal path) — mutually exclusive with href. */
  to?: string;
  /** External URL — opens in a new tab. */
  href?: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}

const ORGANIZERS: { titleKey: string; cards: HomeCard[] }[] = [
  {
    titleKey: "home.org.whatIs",
    cards: [
      {
        href: "https://demo.opendefence.fi",
        icon: MonitorPlay,
        titleKey: "home.demoCard",
        descKey: "home.demoCardDesc",
      },
      {
        to: "/$locale/deploy-app/introduction-d1XzfzOkpz",
        icon: Info,
        titleKey: "home.introCard",
        descKey: "home.introCardDesc",
      },
    ],
  },
  {
    titleKey: "home.org.guides",
    cards: [
      {
        to: "/$locale/deploy-app",
        icon: Smartphone,
        titleKey: "home.userCard",
        descKey: "home.userCardDesc",
      },
      {
        to: "/$locale/guides",
        icon: BookOpen,
        titleKey: "home.guidesCard",
        descKey: "home.guidesCardDesc",
      },
    ],
  },
  {
    titleKey: "home.org.further",
    cards: [
      {
        to: "/$locale/advanced",
        icon: Zap,
        titleKey: "home.powerCard",
        descKey: "home.powerCardDesc",
      },
      {
        to: "/$locale/dev",
        icon: Code2,
        titleKey: "home.devCard",
        descKey: "home.devCardDesc",
      },
    ],
  },
];

function HomePage() {
  const { t } = useTranslation();
  const { locale } = Route.useParams();

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="relative h-20 shrink-0 overflow-hidden md:h-28">
        <img
          src={withBase("/images/poweruser.jpg")}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-background/30" />
      </div>
      <header className={cn(PAGE_FRAME, "-mt-6 md:-mt-8")}>
        <ShelfIndicator className="relative -ml-1 mb-1" />
        <h1 className="relative text-2xl font-bold tracking-tight break-words md:text-3xl">
          {t("app.title")}
        </h1>
        <p className="relative mt-1.5 text-sm text-muted-foreground md:text-base">
          {t("app.tagline")}
        </p>
      </header>
      <div className={cn(PAGE_FRAME, "pt-2 pb-8 md:pb-10")}>
        {ORGANIZERS.map((org) => (
          <Fragment key={org.titleKey}>
            <SectionLabel className="px-1 pt-6 pb-2">
              {t(org.titleKey)}
            </SectionLabel>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:gap-3">
              {org.cards.map((card) => (
                <BookCard
                  key={card.titleKey}
                  locale={locale}
                  to={card.to}
                  href={card.href}
                  icon={card.icon}
                  title={t(card.titleKey)}
                  description={t(card.descKey)}
                  size="tall"
                />
              ))}
            </div>
          </Fragment>
        ))}
        <HomeAbout />
      </div>
      <SiteFooter agentExample={t("agentNote.exampleHome")} />
    </div>
  );
}

/** Set at build time (e.g. repo variable LANDING_URL) — hidden when unset. */
const LANDING_URL = import.meta.env.VITE_LANDING_URL;

// The contribute/integrate/operate doors — each opens a guided orientation flow.
const CONTRIBUTE_DOORS: { track: TrackKey; labelKey: string }[] = [
  { track: "contribute", labelKey: "devShelf.contribute" },
  { track: "integrate", labelKey: "devShelf.integrate" },
  { track: "operate", labelKey: "devShelf.operate" },
];

function WithContactLink({ text }: { text: string }) {
  const [before, ...rest] = text.split(CONTACT_EMAIL);
  if (rest.length === 0) return <>{text}</>;
  return (
    <>
      {before}
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="text-primary underline-offset-2 hover:underline"
      >
        {CONTACT_EMAIL}
      </a>
      {rest.join(CONTACT_EMAIL)}
    </>
  );
}

function HomeAbout() {
  const { t } = useTranslation();
  const [orient, setOrient] = useState<TrackKey | null>(null);

  const goals = [
    { title: "footer.easyTitle", body: "footer.easyBody" },
    { title: "footer.interopTitle", body: "footer.interopBody" },
    { title: "footer.qualityTitle", body: "footer.qualityBody" },
  ];

  return (
    <section className="mt-10 max-w-3xl border-t border-border pt-8 md:mt-12">
      <p className="text-sm leading-relaxed text-foreground md:text-base">
        {t("footer.lead")}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-foreground md:text-base">
        {t("footer.lead2")}
      </p>

      {/* Collapsed by default; native disclosure keeps it JS-free. */}
      <details className="group mt-5 rounded-lg border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-base font-semibold select-none [&::-webkit-details-marker]:hidden">
          {t("footer.tellMore")}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("footer.core")}
          </p>

          {goals.map(({ title, body }) => (
            <div key={title}>
              <SectionLabel as="h3" className="mt-4">
                {t(title)}
              </SectionLabel>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t(body)}
              </p>
            </div>
          ))}

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {t("footer.maintain")}
          </p>

          <p className="mt-4 text-sm">
            {t("footer.readMore")}{" "}
            {LANDING_URL ? (
              <a
                href={LANDING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                {LANDING_URL.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <span className="text-muted-foreground italic">
                {t("footer.siteUnderDev")}
              </span>
            )}
          </p>
        </div>
      </details>

      {/* The three doors for people who want to do more than read. */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-foreground">
          {t("footer.contributeHeadline")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("footer.contributeBody")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CONTRIBUTE_DOORS.map(({ track, labelKey }) => (
            <Button
              key={track}
              variant="outline"
              size="sm"
              onClick={() => {
                markOrientationSeen();
                setOrient(track);
              }}
            >
              {t(labelKey)}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-base font-semibold text-foreground">
          {t("footer.orgTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
          <WithContactLink text={t("footer.orgBody")} />
        </p>
      </div>

      <OrientationModal
        open={orient !== null}
        start={orient ?? "contribute"}
        onOpenChange={(o) => {
          if (!o) setOrient(null);
        }}
      />

      <div className="mt-8">
        <PwaInstallPrompt />
      </div>
    </section>
  );
}
