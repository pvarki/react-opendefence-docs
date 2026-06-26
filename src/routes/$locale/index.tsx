import { Fragment, type ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
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
import { AgentFriendlyNote } from "@/components/shell/AgentFriendlyNote";
import { CARD_IMAGES } from "@/lib/cardImages";
import { withBase } from "@/lib/base";

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
  /** CARD_IMAGES key for an optional card backdrop. */
  img?: string;
}

// Three toporg-style organizers tell the story: what it is, how to read the
// guides, how to develop. Headings render orange like the ATAK guide toporgs.
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
        img: "deploy-app",
      },
      {
        to: "/$locale/guides",
        icon: BookOpen,
        titleKey: "home.guidesCard",
        descKey: "home.guidesCardDesc",
        img: "guides",
      },
    ],
  },
  {
    titleKey: "home.org.develop",
    cards: [
      {
        to: "/$locale/advanced",
        icon: Zap,
        titleKey: "home.powerCard",
        descKey: "home.powerCardDesc",
        img: "advanced",
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

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-1 pt-5 pb-2 text-[11px] font-semibold tracking-widest text-primary uppercase">
      {children}
    </h2>
  );
}

function HomePage() {
  const { t } = useTranslation();
  const { locale } = Route.useParams();

  return (
    <div className="h-full overflow-y-auto">
      {/* Hero: title over a tinted full-width image. */}
      <div className="relative h-40 overflow-hidden border-b border-border md:h-56">
        <img
          src={withBase("/images/poweruser.jpg")}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl px-4 pb-3 md:pb-5">
          <h1 className="text-2xl font-bold md:text-4xl">{t("app.title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground md:mt-1 md:text-base">
            {t("app.tagline")}
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-2xl px-4 py-4 md:py-8">
        {ORGANIZERS.map((org) => (
          <Fragment key={org.titleKey}>
            <SectionHeading>{t(org.titleKey)}</SectionHeading>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
              {org.cards.map((card) => (
                <BookCard
                  key={card.titleKey}
                  locale={locale}
                  to={card.to}
                  href={card.href}
                  icon={card.icon}
                  title={t(card.titleKey)}
                  description={t(card.descKey)}
                  image={card.img ? CARD_IMAGES[card.img] : undefined}
                  size="tall"
                />
              ))}
            </div>
          </Fragment>
        ))}
      </div>
      <HomeFooter />
    </div>
  );
}

/** Set at build time (e.g. repo variable LANDING_URL) — hidden when unset. */
const LANDING_URL = import.meta.env.VITE_LANDING_URL;

const COPYRIGHT_LINES = [
  "Deploy App & this site: © OpenDefence",
  "FDF images: © Finnish Defence Forces",
  "TAK: © TAK Product Center, a U.S. Government organization",
  "Matrix: © The Matrix.org Foundation",
  "MediaMTX: © aler9",
  "CryptPad: © XWiki SAS",
];

// The contribute/integrate/operate doors — each a dev-section collection cover.
const CONTRIBUTE_LINKS = [
  { splat: "contribute-to-project", labelKey: "devShelf.contribute" },
  { splat: "build-an-integration", labelKey: "devShelf.integrate" },
  { splat: "operate", labelKey: "devShelf.operate" },
] as const;

function HomeFooter() {
  const { t } = useTranslation();
  const { locale } = Route.useParams();

  const goals = [
    { title: "footer.easyTitle", body: "footer.easyBody" },
    { title: "footer.interopTitle", body: "footer.interopBody" },
    { title: "footer.qualityTitle", body: "footer.qualityBody" },
  ];

  return (
    <footer className="mt-4 border-t border-border bg-card md:mt-8">
      <div className="mx-auto max-w-2xl px-4 py-6 md:py-10">
        <p className="text-sm leading-relaxed text-foreground">
          {t("footer.lead")}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-foreground">
          {t("footer.lead2")}
        </p>

        {/* Collapsed by default; native disclosure keeps it JS-free. */}
        <details className="group mt-5 rounded-lg border border-border bg-background">
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
                <p className="mt-4 text-[11px] font-semibold tracking-widest text-primary uppercase">
                  {t(title)}
                </p>
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
          <h3 className="text-base font-semibold text-foreground">
            {t("footer.contributeHeadline")}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("footer.contributeBody")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CONTRIBUTE_LINKS.map(({ splat, labelKey }) => (
              <Link
                key={splat}
                to="/$locale/$"
                params={{ locale, _splat: splat }}
                className="rounded-full border border-border px-3 py-1 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {t(labelKey)}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-0.5 border-t border-border pt-4">
          {COPYRIGHT_LINES.map((line) => (
            <p key={line} className="text-[11px] text-muted-foreground/80">
              {line}
            </p>
          ))}
        </div>

        <AgentFriendlyNote example={t("agentNote.exampleHome")} />
      </div>
    </footer>
  );
}
