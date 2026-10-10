import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DEFAULT_LOCALE } from "@shared/content-schema";
import { stripBase, withBase } from "@/lib/base";
import { useBookContext } from "@/lib/bookContext";
import { shelfStopIndex } from "@/lib/shelfNav";
import { useReaderData } from "@/lib/useReaderData";
import { PlatformSelector } from "@/components/shell/PlatformSelector";
import { SettingsMenu } from "@/components/shell/SettingsMenu";
import { CommandMenu } from "@/components/search/CommandMenu";
import { cn } from "@/lib/utils";

// Same order as the swipeable landing-page row.
const NAV_ITEMS = [
  { splat: "deploy-app", key: "nav.deployApp" },
  { splat: "guides", key: "nav.guides" },
  { splat: "advanced", key: "nav.advanced" },
  { splat: "dev", key: "nav.develop" },
] as const;

type NavSplat = (typeof NAV_ITEMS)[number]["splat"];

const SECTION_NAV: Record<string, NavSplat> = {
  "deploy-app": "deploy-app",
  guides: "guides",
  wikis: "advanced",
  dev: "dev",
};

function useActiveNav(locale: string): NavSplat | undefined {
  const book = useBookContext();
  const pathname = useRouterState({
    select: (s) => stripBase(s.location.pathname),
  });
  if (book) {
    const section = book.manifest.collections.find(
      (c) => c.slug === book.collection,
    )?.section;
    if (section) return SECTION_NAV[section];
  }
  const first = pathname.slice(locale.length + 2).split("/")[0];
  return NAV_ITEMS.find((item) => item.splat === first)?.splat;
}

function useHeaderTitle(locale: string): string {
  const { t } = useTranslation();
  const book = useBookContext();
  const reader = useReaderData();
  const pathname = useRouterState({
    select: (s) => stripBase(s.location.pathname),
  });
  const isCover = !!reader && !reader.slug;
  if (book && !isCover) {
    return (
      book.manifest.collections.find((c) => c.slug === book.collection)
        ?.label ?? book.collection
    );
  }
  if (pathname.startsWith(`/${locale}/search`)) return t("nav.search");
  if (shelfStopIndex(pathname, locale) === 0) return "";
  return t("app.title");
}

export function Header() {
  const { t } = useTranslation();
  const params = useParams({ strict: false });
  const locale = params.locale ?? DEFAULT_LOCALE;
  const title = useHeaderTitle(locale);
  const activeNav = useActiveNav(locale);

  return (
    <header className="sticky top-0 z-50 flex h-[var(--header-h)] shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 md:gap-4 md:px-4">
      <div className="flex min-w-0 items-center gap-2 self-stretch md:gap-5">
        <Link
          to="/$locale"
          params={{ locale }}
          aria-label={t("app.title")}
          className="flex shrink-0 items-center gap-2 rounded-md font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img
            src={withBase("/icons/pvatk.png")}
            alt=""
            aria-hidden
            className="size-7 shrink-0 rounded-md object-contain"
          />
          <span className="hidden text-sm xl:inline">{t("app.title")}</span>
        </Link>

        <p className="truncate text-sm font-semibold md:hidden">{title}</p>

        <nav className="hidden self-stretch md:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.splat === activeNav;
            return (
              <Link
                key={item.splat}
                to={`/$locale/${item.splat}` as string}
                params={{ locale }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center px-2.5 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset lg:px-3",
                  active
                    ? "font-medium text-foreground after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
        <CommandMenu />
        <div className="hidden md:block">
          <PlatformSelector />
        </div>
        <SettingsMenu />
      </div>
    </header>
  );
}
