import { Link, createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookOpen, Code2, Smartphone } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <h1 className="text-3xl font-bold md:text-4xl">{t("app.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("app.tagline")}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {CARDS.map(({ to, icon: Icon, titleKey, descKey }) => (
            <Link
              key={to}
              to={`/$locale/${to}` as string}
              params={{ locale }}
              className="group focus-visible:outline-none"
            >
              <Card className="h-full gap-3 py-5 transition-colors group-hover:border-primary group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CardHeader>
                  <Icon className="mb-2 size-7 text-primary" />
                  <CardTitle>{t(titleKey)}</CardTitle>
                  <CardDescription>{t(descKey)}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
