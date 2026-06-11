import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  House,
  MonitorSmartphone,
  Search,
  Smartphone,
  TableOfContents,
  Zap,
} from "lucide-react";
import { DEFAULT_LOCALE } from "@shared/content-schema";
import { PLATFORM_LABELS, useReadingView } from "@/lib/platform";
import { resolveClient } from "@/lib/content/neighbors";
import { useReaderData } from "@/lib/useReaderData";
import { ContentsSheet } from "@/components/shell/ContentsDrawer";
import { PlatformSheet } from "@/components/shell/PlatformSheet";

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
  {
    to: "/$locale/advanced",
    splat: undefined,
    icon: Zap,
    key: "nav.advanced",
  },
  { to: "/$locale/search", splat: undefined, icon: Search, key: "nav.search" },
] as const;

/**
 * Mobile bottom bar, Wikipedia-style. App tabs at home/shelves; inside a
 * book: Home / Search / Platform / Guides, and a larger border-separated
 * Contents button RIGHTMOST — under the right thumb. No back button: swiping
 * right is back. Chapters live behind Contents (there are too many for
 * chips) and on the book cover's full TOC.
 */
export function TabBar() {
  const { t } = useTranslation();
  const params = useParams({ strict: false });
  const locale = params.locale ?? DEFAULT_LOCALE;
  const reader = useReaderData();
  const view = useReadingView();
  const [contentsOpen, setContentsOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);

  const activeClient = reader
    ? resolveClient(reader.manifest, reader.collection, view)
    : undefined;
  const platformLabel = activeClient?.label ?? PLATFORM_LABELS[view.platform];

  const itemClass =
    "flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors";

  return (
    <nav
      aria-label={t("nav.home")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {reader ? (
        <div className="flex h-14 items-stretch">
          <Link to="/$locale" params={{ locale }} className={itemClass}>
            <House className="size-5" />
            <span className="text-[10px] leading-none">{t("nav.home")}</span>
          </Link>
          <Link to="/$locale/search" params={{ locale }} className={itemClass}>
            <Search className="size-5" />
            <span className="text-[10px] leading-none">{t("nav.search")}</span>
          </Link>
          <button
            type="button"
            onClick={() => setPlatformOpen(true)}
            className={itemClass}
            aria-label={t("platform.label")}
          >
            <MonitorSmartphone className="size-5" />
            <span className="max-w-16 truncate text-[10px] leading-none">
              {platformLabel}
            </span>
          </button>
          <Link to="/$locale/guides" params={{ locale }} className={itemClass}>
            <BookOpen className="size-5" />
            <span className="text-[10px] leading-none">{t("nav.guides")}</span>
          </Link>
          <button
            type="button"
            onClick={() => setContentsOpen(true)}
            className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-l border-border px-6 text-foreground"
            aria-label={t("nav.contents")}
          >
            <TableOfContents className="size-6 text-primary" />
            <span className="text-[11px] leading-none font-medium">
              {t("nav.contents")}
            </span>
          </button>

          <ContentsSheet
            open={contentsOpen}
            onOpenChange={setContentsOpen}
            locale={locale}
            contentLocale={reader.contentLocale}
            collection={reader.collection}
            currentSlug={reader.slug}
            clientId={activeClient?.id}
          />
          <PlatformSheet
            open={platformOpen}
            onOpenChange={setPlatformOpen}
            locale={locale}
            reader={reader}
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
