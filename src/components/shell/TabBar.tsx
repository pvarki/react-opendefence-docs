import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Code2,
  House,
  Search,
  Smartphone,
  TableOfContents,
} from "lucide-react";
import { DEFAULT_LOCALE, type ManifestPage } from "@shared/content-schema";
import { usePlatform } from "@/lib/platform";
import { useReaderData } from "@/lib/useReaderData";
import { readingOrder } from "@/lib/content/neighbors";
import { ContentsSheet } from "@/components/shell/ContentsDrawer";
import { cn } from "@/lib/utils";

const HOME_TABS = [
  {
    to: "/$locale",
    splat: undefined,
    icon: House,
    key: "nav.home",
    exact: true,
  },
  {
    to: "/$locale/$",
    splat: "deploy-app",
    icon: Smartphone,
    key: "nav.deployApp",
  },
  {
    to: "/$locale/guides",
    splat: undefined,
    icon: BookOpen,
    key: "nav.guides",
  },
  { to: "/$locale/dev", splat: undefined, icon: Code2, key: "nav.develop" },
  { to: "/$locale/search", splat: undefined, icon: Search, key: "nav.search" },
] as const;

interface Chapter {
  id: string;
  label: string;
  firstPage: ManifestPage;
}

/**
 * Mobile bottom bar, Wikipedia-style: app tabs everywhere, but inside a book
 * it becomes the book's chapter bar — Contents leftmost (swiping right covers
 * "back"), then one chip per chapter of the active platform, horizontally
 * scrollable when they don't fit.
 */
export function TabBar() {
  const { t } = useTranslation();
  const params = useParams({ strict: false });
  const locale = params.locale ?? DEFAULT_LOCALE;
  const reader = useReaderData();
  const platform = usePlatform();
  const navigate = useNavigate();
  const [contentsOpen, setContentsOpen] = useState(false);

  const chapters: Chapter[] = useMemo(() => {
    if (!reader) return [];
    const order = readingOrder(reader.manifest, reader.collection, platform);
    const seen = new Map<string, Chapter>();
    for (const page of order) {
      const id = page.chapterId ?? "_top";
      if (!seen.has(id)) {
        seen.set(id, {
          id,
          label:
            page.chapterLabel ??
            reader.manifest.collections.find(
              (c) => c.slug === reader.collection,
            )?.label ??
            "",
          firstPage: page,
        });
      }
    }
    return [...seen.values()];
  }, [reader, platform]);

  const currentChapterId = useMemo(() => {
    if (!reader?.slug) return undefined;
    const page = reader.manifest.pages.find(
      (p) => p.collection === reader.collection && p.slug === reader.slug,
    );
    return page?.chapterId ?? "_top";
  }, [reader]);

  return (
    <nav
      aria-label={t("nav.home")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {reader && chapters.length > 0 ? (
        <div className="flex h-14 items-stretch">
          <button
            type="button"
            onClick={() => setContentsOpen(true)}
            className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-r border-border px-3 text-muted-foreground"
            aria-label={t("nav.contents")}
          >
            <TableOfContents className="size-5" />
            <span className="text-[10px] leading-none">
              {t("nav.contents")}
            </span>
          </button>
          <div className="flex flex-1 items-center gap-1 overflow-x-auto px-2 [scrollbar-width:none]">
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() =>
                  void navigate({
                    to: "/$locale/$",
                    params: {
                      locale,
                      _splat: `${chapter.firstPage.collection}/${chapter.firstPage.slug}`,
                    },
                  })
                }
                aria-current={
                  chapter.id === currentChapterId ? "true" : undefined
                }
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
                  chapter.id === currentChapterId
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {chapter.label}
              </button>
            ))}
          </div>
          <ContentsSheet
            open={contentsOpen}
            onOpenChange={setContentsOpen}
            locale={locale}
            contentLocale={reader.contentLocale}
            collection={reader.collection}
            currentSlug={reader.slug}
          />
        </div>
      ) : (
        <div className="grid h-14 grid-cols-5">
          {HOME_TABS.map(({ to, splat, icon: Icon, key, ...rest }) => (
            <Link
              key={key}
              to={to}
              params={splat ? { locale, _splat: splat } : { locale }}
              activeOptions={{ exact: "exact" in rest && rest.exact }}
              className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors [&.active]:text-primary"
              activeProps={{ "aria-current": "page" }}
            >
              <Icon className="size-5" />
              <span className="text-[10px] leading-none">{t(key)}</span>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
