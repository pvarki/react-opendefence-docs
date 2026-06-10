import { useEffect } from "react";
import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { normalizeLocale } from "@shared/content-schema";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/$locale")({
  beforeLoad: ({ params }) => {
    const locale = normalizeLocale(params.locale);
    if (!locale) throw notFound();
    return { locale };
  },
  component: LocaleLayout,
});

function LocaleLayout() {
  const { locale } = Route.useParams();

  useEffect(() => {
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
  }, [locale]);

  return <Outlet />;
}
