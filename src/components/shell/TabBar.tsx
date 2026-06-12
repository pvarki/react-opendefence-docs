import { useState } from "react";
import {
  Link,
  useCanGoBack,
  useParams,
  useRouter,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, House, Search, TableOfContents } from "lucide-react";
import { DEFAULT_LOCALE, normalizeLocale } from "@shared/content-schema";
import {
  PLATFORM_LABELS,
  stripPlatformSuffix,
  useReadingView,
} from "@/lib/platform";
import { resolveClient } from "@/lib/content/neighbors";
import { useReaderData } from "@/lib/useReaderData";
import { ContentsSheet } from "@/components/shell/ContentsDrawer";
import { PlatformIcon } from "@/components/shell/PlatformIcon";
import { SiteContentsSheet } from "@/components/shell/SiteContentsSheet";
import { PlatformSheet } from "@/components/shell/PlatformSheet";
import { useShelfContext } from "@/lib/useShelfContext";

/**
 * Mobile bottom bar — five controls in the same places everywhere:
 * Contents (leftmost, larger, border-separated) · Home · shelf · Platform ·
 * Search. Phones ride in the right hand, so Contents and the floating back
 * button above it sit on the LEFT, clear of the thumb's resting side.
 * Two slots are context-aware: Contents opens the current book's TOC in a
 * reader and the site-wide TOC elsewhere; the shelf slot is Guides,
 * Advanced or Developer depending on what's being read.
 */
export function TabBar() {
  const { t } = useTranslation();
  const params = useParams({ strict: false });
  const locale = params.locale ?? DEFAULT_LOCALE;
  const contentLocale = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  const reader = useReaderData();
  const view = useReadingView();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const [contentsOpen, setContentsOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);

  const activeClient = reader
    ? resolveClient(reader.manifest, reader.collection, view)
    : undefined;
  const platformLabel = activeClient
    ? stripPlatformSuffix(activeClient.label)
    : PLATFORM_LABELS[view.platform];
  const shelf = useShelfContext();
  const ShelfIcon = shelf.icon;

  const itemClass =
    "flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors [&.active]:text-primary";

  return (
    <>
      {/* History back, floating above Home — reachable with the thumb. */}
      {canGoBack && (
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label={t("nav.back")}
          className="fixed bottom-[calc(var(--tabbar-h)+0.75rem)] left-3 z-50 flex size-10 items-center justify-center rounded-full border border-border bg-card/95 text-muted-foreground shadow-lg backdrop-blur md:hidden"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}

      <nav
        aria-label={t("nav.home")}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="flex h-14 items-stretch">
          <button
            type="button"
            onClick={() => setContentsOpen(true)}
            className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-r border-border px-6 text-foreground"
            aria-label={t("nav.contents")}
          >
            <TableOfContents className="size-6 text-primary" />
            <span className="text-[11px] leading-none font-medium">
              {t("nav.contents")}
            </span>
          </button>
          <Link
            to="/$locale"
            params={{ locale }}
            activeOptions={{ exact: true }}
            className={itemClass}
            activeProps={{ "aria-current": "page" }}
          >
            <House className="size-5" />
            <span className="text-[10px] leading-none">{t("nav.home")}</span>
          </Link>
          <Link
            to={shelf.to}
            params={{ locale }}
            className={itemClass}
            activeProps={{ "aria-current": "page" }}
          >
            <ShelfIcon className="size-5" />
            <span className="text-[10px] leading-none">
              {t(shelf.labelKey)}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setPlatformOpen(true)}
            className={itemClass}
            aria-label={t("platform.label")}
          >
            <PlatformIcon
              platform={activeClient?.platform ?? view.platform}
              className="size-5"
            />
            <span className="max-w-16 truncate text-[10px] leading-none">
              {platformLabel}
            </span>
          </button>
          <Link
            to="/$locale/search"
            params={{ locale }}
            className={itemClass}
            activeProps={{ "aria-current": "page" }}
          >
            <Search className="size-5" />
            <span className="text-[10px] leading-none">{t("nav.search")}</span>
          </Link>
        </div>

        {reader ? (
          <ContentsSheet
            open={contentsOpen}
            onOpenChange={setContentsOpen}
            locale={locale}
            reader={reader}
          />
        ) : (
          <SiteContentsSheet
            open={contentsOpen}
            onOpenChange={setContentsOpen}
            locale={contentLocale}
          />
        )}
        <PlatformSheet
          open={platformOpen}
          onOpenChange={setPlatformOpen}
          locale={locale}
          reader={reader}
        />
      </nav>
    </>
  );
}
