import { useCallback, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { searchDocs, type SearchHit } from "@/lib/search/pagefind-client";

export const Route = createFileRoute("/$locale/search")({
  component: SearchPage,
});

/** Full-page search — the mobile tab target (desktop uses the ⌘K palette). */
function SearchPage() {
  const { t } = useTranslation();
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
        <label className="flex items-center gap-3 rounded-lg border border-input bg-card px-4 py-3 focus-within:ring-2 focus-within:ring-ring">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t("search.placeholder")}
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>

        <div className="mt-4">
          {query.trim().length >= 2 && hits.length === 0 && (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              {searching ? t("search.searching") : t("search.noResults")}
            </p>
          )}
          <ul className="space-y-1">
            {hits.map((hit) => (
              <li key={hit.url}>
                <Link
                  to={hit.url}
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
