import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import { useTranslation } from "react-i18next";
import type { LocaleManifest, ManifestPage } from "@shared/content-schema";
import { loadPage } from "@/lib/content/loader";
import { readingOrder, resolvePosition, resolveSplat } from "@/lib/content/neighbors";
import { pageSwiperOptions } from "@/components/reader/emblaPageOptions";
import { PagePane } from "@/components/reader/PagePane";
import { useReducedMotion } from "@/components/reader/useReducedMotion";

interface PageSwiperProps {
  locale: string;
  manifest: LocaleManifest;
  collection: string;
  slug: string;
}

/**
 * Book-like swipe navigation. The URL is the single source of truth:
 * - a settled swipe commits a history push (so OS back-gestures land on the
 *   previous page — the only sane behavior on iOS standalone);
 * - URL changes from links/back/forward animate when the target is the
 *   adjacent pane, otherwise jump instantly.
 * Only prev/current/next panes are mounted, keyed by slug so the visible
 * pane's DOM survives window shifts without remounting.
 */
export function PageSwiper({ locale, manifest, collection, slug }: PageSwiperProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const order = useMemo(() => readingOrder(manifest, collection), [manifest, collection]);

  // The slug whose window is currently rendered. Lags the URL slug while an
  // animated page turn (from a link/back navigation) is in flight.
  const [windowSlug, setWindowSlug] = useState(slug);

  const windowIndex = order.findIndex((p) => p.slug === windowSlug);
  const windowPages = useMemo(
    () =>
      [order[windowIndex - 1], order[windowIndex], order[windowIndex + 1]].filter(
        (p): p is ManifestPage => p !== undefined,
      ),
    [order, windowIndex],
  );
  const startIndex = windowIndex === 0 ? 0 : 1;

  const navLockRef = useRef(false);
  const guards = useRef({ navLocked: () => navLockRef.current }).current;

  const [viewportRef, embla] = useEmblaCarousel(
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options identity keyed on the window
    useMemo(() => pageSwiperOptions(startIndex, guards), [windowSlug, startIndex, guards]),
    useMemo(() => [WheelGesturesPlugin()], []),
  );

  const navigateToPage = useCallback(
    (page: ManifestPage) => {
      navLockRef.current = true;
      void navigate({
        to: "/$locale/$",
        params: { locale, _splat: `${page.collection}/${page.slug}` },
      });
    },
    [navigate, locale],
  );

  // Gesture path: a settle on a neighbor pane commits the navigation.
  useEffect(() => {
    if (!embla) return;
    const onSettle = () => {
      const selected = embla.selectedScrollSnap();
      const target = windowPages[selected];
      // Skip when already current — incl. settles from OUR animated scrollTo
      // during link/back reconciliation, where the URL leads the window.
      if (!target || target.slug === windowSlug || target.slug === slug) return;
      navigateToPage(target);
    };
    embla.on("settle", onSettle);
    return () => {
      embla.off("settle", onSettle);
    };
  }, [embla, windowPages, windowSlug, slug, navigateToPage]);

  // URL path: reconcile the rendered window with the slug from the route.
  useLayoutEffect(() => {
    if (slug === windowSlug) {
      navLockRef.current = false;
      return;
    }
    if (navLockRef.current) {
      // We initiated this navigation from a settled gesture: shift the window
      // silently — the settled pane is already what the reader sees.
      setWindowSlug(slug);
      return;
    }
    const adjacentIndex = windowPages.findIndex((p) => p.slug === slug);
    if (embla && adjacentIndex !== -1 && !reducedMotion) {
      // Link/back/forward to the adjacent page: animate the page turn, then
      // shift the window once the animation settles.
      const onSettle = () => {
        embla.off("settle", onSettle);
        setWindowSlug(slug);
      };
      embla.on("settle", onSettle);
      embla.scrollTo(adjacentIndex, false);
    } else {
      setWindowSlug(slug);
    }
  }, [slug, windowSlug, windowPages, embla, reducedMotion]);

  // Whenever the window re-renders, snap the carousel to the current pane.
  useLayoutEffect(() => {
    if (!embla) return;
    embla.scrollTo(startIndex, true);
  }, [embla, windowSlug, startIndex]);

  // Preload neighbors so a swipe reveals content, not a skeleton.
  useEffect(() => {
    for (const page of windowPages) {
      if (page.slug !== windowSlug) void loadPage(page.path).catch(() => {});
    }
  }, [windowPages, windowSlug]);

  // Keyboard page turns (skipped when typing or inside a slideset's scope).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as Element | null;
      if (target?.closest("input,textarea,select,[contenteditable=true],[data-swipe-scope]")) {
        return;
      }
      // Resolve from the router's live location: props lag the URL during
      // animated transitions, and rapid keypresses must not be dropped.
      const pathname = router.state.location.pathname;
      const splat = pathname.startsWith(`/${locale}/`)
        ? pathname.slice(locale.length + 2)
        : "";
      const resolved = resolveSplat(manifest, decodeURIComponent(splat));
      if (!resolved?.slug) return;
      const current = resolvePosition(manifest, resolved.collection, resolved.slug);
      const dest = e.key === "ArrowLeft" ? current?.prev : current?.next;
      if (dest) {
        e.preventDefault();
        void navigate({
          to: "/$locale/$",
          params: { locale, _splat: `${dest.collection}/${dest.slug}` },
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [manifest, router, navigate, locale]);

  const position = resolvePosition(manifest, collection, windowSlug);
  const nextBook = useMemo(() => {
    if (!position || position.index !== position.total - 1) return undefined;
    const current = manifest.collections.find((c) => c.slug === collection);
    const next = manifest.collections.find(
      (c) => current && c.section === current.section && c.order === current.order + 1,
    );
    return next ? { label: next.label, href: `/${locale}/${next.slug}` } : undefined;
  }, [position, manifest, collection, locale]);

  if (!position) return null;

  return (
    <div className="relative h-full">
      {/* Reading progress under the header */}
      <div className="absolute inset-x-0 top-0 z-10 h-0.5 bg-muted">
        <div
          data-testid="reading-progress"
          className="h-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${((position.index + 1) / position.total) * 100}%` }}
        />
      </div>

      <div ref={viewportRef} className="h-full touch-pan-y overflow-hidden">
        <div className="flex h-full">
          {windowPages.map((page) => (
            <PagePane
              key={page.slug}
              locale={locale}
              page={page}
              position={resolvePosition(manifest, collection, page.slug) ?? position}
              isCurrent={page.slug === windowSlug}
              nextBook={nextBook}
            />
          ))}
        </div>
      </div>

      <span aria-live="polite" className="sr-only">
        {t("reader.pageAnnouncement", {
          title: position.page.title,
          current: position.index + 1,
          total: position.total,
        })}
      </span>
    </div>
  );
}
