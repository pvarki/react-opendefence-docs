import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookOpen, Code2, Smartphone, Zap } from "lucide-react";
import { BookCard } from "@/components/shell/BookCard";
import { CARD_IMAGES } from "@/lib/cardImages";
import { withBase } from "@/lib/base";

export const Route = createFileRoute("/$locale/")({
  component: HomePage,
});

const CARDS = [
  {
    to: "deploy-app",
    icon: Smartphone,
    titleKey: "home.userCard",
    descKey: "home.userCardDesc",
  },
  {
    to: "guides",
    icon: BookOpen,
    titleKey: "home.guidesCard",
    descKey: "home.guidesCardDesc",
  },
  {
    to: "advanced",
    icon: Zap,
    titleKey: "home.powerCard",
    descKey: "home.powerCardDesc",
  },
  {
    to: "dev",
    icon: Code2,
    titleKey: "home.devCard",
    descKey: "home.devCardDesc",
  },
] as const;

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
        <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl px-4 pb-3 md:pb-5">
          <h1 className="text-2xl font-bold md:text-4xl">{t("app.title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground md:mt-1 md:text-base">
            {t("app.tagline")}
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-4 md:py-8">
        <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
          {CARDS.map(({ to, icon, titleKey, descKey }) => (
            <BookCard
              key={to}
              locale={locale}
              to={`/$locale/${to}`}
              icon={icon}
              title={t(titleKey)}
              description={t(descKey)}
              image={CARD_IMAGES[to]}
              size="tall"
            />
          ))}
        </div>
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

function HomeFooter() {
  const { t } = useTranslation();

  return (
    <footer className="mt-4 border-t border-border bg-card md:mt-8">
      <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
        <p className="text-sm leading-relaxed text-foreground">
          {t("footer.lead")}
        </p>

        <h2 className="mt-5 text-base font-semibold">{t("footer.tellMore")}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("footer.core")}
        </p>

        <p className="mt-4 text-[11px] font-semibold tracking-widest text-primary uppercase">
          {t("footer.easyTitle")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t("footer.easyBody")}
        </p>

        <p className="mt-4 text-[11px] font-semibold tracking-widest text-primary uppercase">
          {t("footer.interopTitle")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t("footer.interopBody")}
        </p>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {t("footer.maintain")}
        </p>

        {LANDING_URL && (
          <p className="mt-4 text-sm">
            {t("footer.readMore")}{" "}
            <a
              href={LANDING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {LANDING_URL.replace(/^https?:\/\//, "")}
            </a>
          </p>
        )}

        <div className="mt-6 space-y-0.5 border-t border-border pt-4">
          {COPYRIGHT_LINES.map((line) => (
            <p key={line} className="text-[11px] text-muted-foreground/80">
              {line}
            </p>
          ))}
        </div>
      </div>
    </footer>
  );
}
