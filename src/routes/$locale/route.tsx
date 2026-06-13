import { useEffect } from "react";
import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { normalizeLocale } from "@shared/content-schema";
import i18n from "@/lib/i18n";
import { useShelfSwipe } from "@/lib/useShelfSwipe";

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

  // Horizontal swipe / arrow keys / wheel turn between the bookshelf-level
  // landing pages; a no-op on every other route.
  useShelfSwipe();

  useEffect(() => {
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
    // Keeps a11y + pagefind's per-language index selection correct.
    document.documentElement.lang = locale;
  }, [locale]);

  return <Outlet />;
}
