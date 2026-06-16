import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { LOCALES, normalizeLocale, type Locale } from "@shared/content-schema";
import { storeLocale } from "@/lib/i18n";
import { stripBase } from "@/lib/base";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fi: "Suomi",
  sv: "Svenska",
};

export function LocaleSwitcher() {
  const { t } = useTranslation();
  const params = useParams({ strict: false });
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = normalizeLocale(params.locale ?? "") ?? "en";

  const onChange = (value: string) => {
    const next = normalizeLocale(value);
    if (!next || next === current) return;
    storeLocale(next);
    // Exact counterpart paths via translations.json come with M2; until then
    // swap the locale prefix and let the loader 404-fallback handle gaps.
    const nextPath = stripBase(pathname).replace(`/${current}`, `/${next}`);
    void navigate({ to: nextPath });
  };

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className="gap-2 border-input bg-transparent"
        aria-label={t("common.language")}
      >
        <Languages className="size-4" />
        <span className="hidden sm:inline">{LOCALE_LABELS[current]}</span>
      </SelectTrigger>
      <SelectContent align="end">
        {LOCALES.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
