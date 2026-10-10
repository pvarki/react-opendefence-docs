import { useCallback, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { searchDocs, type SearchHit } from "@/lib/search/pagefind-client";
import { SHELF_LABEL_KEYS, SHELF_STOPS } from "@/lib/shelfNav";

export const Route = createFileRoute("/$locale/search")({
  component: SearchPage,
});

// Product names are not translated.
const SUGGESTIONS = [
  "ATAK",
  "iTAK",
  "Matrix",
  "Element X",
  "MediaMTX",
  "CryptPad",
];

/** Full-page search — the mobile tab target (desktop uses the ⌘K palette). */
function SearchPage() {
  const { t } = useTranslation();
  const { locale } = Route.useParams();
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onChange = useCallback((value: string) => {
    setQuery(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setSearching(true);
      void searchDocs(value)
        .then(setHits)
        .finally(() => setSearching(false));
    }, 150);
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 md:py-8">
        <h1 className="sr-only">{t("nav.search")}</h1>
        <label className="flex items-center gap-3 rounded-lg border border-input bg-card px-4 py-3 focus-within:ring-2 focus-within:ring-ring">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t("search.placeholder")}
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            // iOS zooms the page into inputs under 16px; text size can go below that.
            className="w-full bg-transparent text-[max(16px,1rem)] outline-none placeholder:text-muted-foreground"
          />
        </label>

        <div className="mt-4">
          {query.trim().length < 2 && (
            <div className="px-1">
              <SectionLabel as="p" className="pb-2">
                {t("search.suggested")}
              </SectionLabel>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((term) => (
                  <Button
                    key={term}
                    variant="outline"
                    size="sm"
                    onClick={() => onChange(term)}
                  >
                    {term}
                  </Button>
                ))}
              </div>
              <SectionLabel as="p" className="pt-6 pb-2">
                {t("search.browse")}
              </SectionLabel>
              <ul className="space-y-0.5">
                {SHELF_STOPS.filter((s) => s.path).map((stop) => (
                  <li key={stop.id}>
                    <Link
                      to={`/$locale/${stop.path}` as string}
                      params={{ locale }}
                      className="block rounded-lg px-3 py-2 text-sm hover:bg-card"
                    >
                      {t(SHELF_LABEL_KEYS[stop.id])}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {query.trim().length >= 2 && hits.length === 0 && (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              {searching ? t("search.searching") : t("search.noResults")}
            </p>
          )}
          <ul className="space-y-1">
            {query.trim().length >= 2 &&
              hits.map((hit) => (
                <li key={hit.url}>
                  <Link
                    to={hit.to}
                    search={hit.search}
                    className="block rounded-lg px-3 py-2.5 hover:bg-card"
                  >
                    <p className="font-medium">{hit.title}</p>
                    <p
                      className="mt-0.5 line-clamp-2 text-sm text-muted-foreground [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-primary"
                      dangerouslySetInnerHTML={{ __html: hit.excerpt }}
                    />
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
