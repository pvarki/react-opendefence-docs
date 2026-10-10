import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { normalizeLocale, type Locale } from "@shared/content-schema";
import { storeLocale } from "@/lib/i18n";
import { stripBase } from "@/lib/base";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fi: "Suomi",
  sv: "Svenska",
};

export function useLocaleSwitch() {
  const params = useParams({ strict: false });
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = normalizeLocale(params.locale ?? "") ?? "en";

  const switchTo = (value: string) => {
    const next = normalizeLocale(value);
    if (!next || next === current) return;
    storeLocale(next);
    // Exact counterpart paths via translations.json come with M2; until then
    // swap the locale prefix and let the loader 404-fallback handle gaps.
    const nextPath = stripBase(pathname).replace(`/${current}`, `/${next}`);
    void navigate({ to: nextPath });
  };

  return { current, switchTo };
}
