import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { getStoredLocale } from "@/lib/i18n";

export function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-5xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold">{t("common.notFound")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("common.notFoundDesc")}
      </p>
      <Button asChild variant="outline">
        <Link to="/$locale" params={{ locale: getStoredLocale() }}>
          {t("common.goHome")}
        </Link>
      </Button>
    </div>
  );
}
