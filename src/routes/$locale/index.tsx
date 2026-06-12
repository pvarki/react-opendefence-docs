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
    to: "guides",
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
    </div>
  );
}
