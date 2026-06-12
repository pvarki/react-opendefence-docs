import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookOpen, Code2, Smartphone, Zap } from "lucide-react";
import { BookCard } from "@/components/shell/BookCard";
import { CARD_IMAGES } from "@/lib/cardImages";

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
      <div className="mx-auto max-w-3xl px-4 py-5 md:py-12">
        <h1 className="text-xl font-bold md:text-4xl">{t("app.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground md:mt-2 md:text-base">
          {t("app.tagline")}
        </p>

        <div className="mt-4 grid gap-2.5 md:mt-8 md:grid-cols-2 md:gap-3">
          {CARDS.map(({ to, icon, titleKey, descKey }) => (
            <BookCard
              key={to}
              locale={locale}
              to={`/$locale/${to}`}
              icon={icon}
              title={t(titleKey)}
              description={t(descKey)}
              image={CARD_IMAGES[to]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
