import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";

export const Route = createFileRoute("/$locale/search")({
  component: SearchPage,
});

// Full-text pagefind search lands in M5; this page is the mobile tab target.
function SearchPage() {
  const { t } = useTranslation();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">{t("nav.search")}</h1>
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-input bg-card px-4 py-3 text-muted-foreground">
          <Search className="size-4" />
          {t("search.placeholder")}
        </div>
      </div>
    </div>
  );
}
