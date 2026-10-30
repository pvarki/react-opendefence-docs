import {
  useNavigate,
  useParams,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import {
  LOCALES,
  normalizeLocale,
  type Locale,
  type TranslationsFile,
} from "@shared/content-schema";
import { storeLocale } from "@/lib/i18n";
import { stripBase } from "@/lib/base";
import { counterpartPath } from "@/lib/content/counterpart";
import { loadTranslations } from "@/lib/content/loader";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fi: "Suomi",
  sv: "Svenska",
};

export function useLocaleSwitch() {
  const params = useParams({ strict: false });
  const navigate = useNavigate();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = normalizeLocale(params.locale ?? "") ?? "en";

  const switchTo = async (value: string) => {
    const next = normalizeLocale(value);
    if (!next || next === current) return;
    const path = stripBase(pathname);
    const files = await Promise.all(
      LOCALES.map((l) =>
        loadTranslations(l).catch((): TranslationsFile => ({})),
      ),
    );
    // The reader moved on while the links loaded: don't pull them back.
    if (router.state.location.pathname !== pathname) return;
    storeLocale(next);
    // Without a known counterpart, keep the same page under the new locale:
    // the reader route shows it in its own language with a banner.
    const nextPath =
      counterpartPath(path, next, files) ??
      path.replace(`/${current}`, `/${next}`);
    void navigate({ to: nextPath });
  };

  return { current, switchTo };
}
