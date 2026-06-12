import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import { useTranslation } from "react-i18next";
import type { LocaleManifest, ManifestPage } from "@shared/content-schema";
import type { ReadingView } from "@/lib/platform";
import { loadPage } from "@/lib/content/loader";
import {
  globalReadingOrder,
  resolveGlobalPosition,
  resolveSplat,
} from "@/lib/content/neighbors";
import { pageSwiperOptions } from "@/components/reader/emblaPageOptions";
import { stripBase } from "@/lib/base";
import { PagePane } from "@/components/reader/PagePane";
import { useReducedMotion } from "@/components/reader/useReducedMotion";

interface PageSwiperProps {
  locale: string;
  manifest: LocaleManifest;
  collection: string;
  slug: string;
  /** Active view (platform + per-book clients): the swipe order covers it start to finish. */
  view?: ReadingView;
}

/** Slugs are unique per collection only — windowing keys on both. */
const keyOf = (page: ManifestPage) => `${page.collection}/${page.slug}`;

/**
 * Book-like swipe navigation over the GLOBAL reading order: pages flow
 * through chapters and across book boundaries, so the whole app reads as one
 * continuous swipe for the active platform. The URL is the single source of
 * truth:
 * - a settled swipe commits a history push (so OS back-gestures land on the
 *   previous page — the only sane behavior on iOS standalone);
 * - URL changes from links/back/forward animate when the target is the
 *   adjacent pane, otherwise jump instantly.
 * Only prev/current/next panes are mounted, keyed by collection/slug so the
 * visible pane's DOM survives window shifts without remounting.
 */
export function PageSwiper({
  locale,
  manifest,
  collection,
  slug,
  view,
}: PageSwiperProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const order = useMemo(
    () => globalReadingOrder(manifest, view),
    [manifest, view],
  );

  const urlKey = `${collection}/${slug}`;

  // The page whose window is currently rendered. Lags the URL while an
  // animated page turn (from a link/back navigation) is in flight.
  const [windowKey, setWindowKey] = useState(urlKey);

  const windowIndex = order.findIndex((p) => keyOf(p) === windowKey);
  const windowPages = useMemo(
    () =>
      [
        order[windowIndex - 1],
        order[windowIndex],
        order[windowIndex + 1],
      ].filter((p): p is ManifestPage => p !== undefined),
    [order, windowIndex],
  );
  const startIndex = windowIndex === 0 ? 0 : 1;

  const navLockRef = useRef(false);
  // navLockRef is read inside Embla's watchDrag at gesture time, never during
  // render; the react-hooks/refs rule can't see across the factory boundary.
  /* eslint-disable react-hooks/refs */
  const guards = useMemo(() => ({ navLocked: () => navLockRef.current }), []);

  const [viewportRef, embla] = useEmblaCarousel(
    useMemo(() => pageSwiperOptions(startIndex, guards), [startIndex, guards]),
    useMemo(() => [WheelGesturesPlugin()], []),
  );
  /* eslint-enable react-hooks/refs */

  const navigateToPage = useCallback(
    (page: ManifestPage) => {
      navLockRef.current = true;
      void navigate({
        to: "/$locale/$",
        params: { locale, _splat: keyOf(page) },
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
      if (!target || keyOf(target) === windowKey || keyOf(target) === urlKey)
        return;
      navigateToPage(target);
    };
    embla.on("settle", onSettle);
    return () => {
      embla.off("settle", onSettle);
    };
  }, [embla, windowPages, windowKey, urlKey, navigateToPage]);

  // URL path: reconcile the rendered window with the page from the route.
  // Embla is an external animation engine; this effect is the designed sync
  // point between it and the URL, so the setState here is intentional.
  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    if (urlKey === windowKey) {
      navLockRef.current = false;
      return;
    }
    if (navLockRef.current) {
      // We initiated this navigation from a settled gesture: shift the window
      // silently — the settled pane is already what the reader sees.
      setWindowKey(urlKey);
      return;
    }
    const adjacentIndex = windowPages.findIndex((p) => keyOf(p) === urlKey);
    if (embla && adjacentIndex !== -1 && !reducedMotion) {
      // Link/back/forward to the adjacent page: animate the page turn, then
      // shift the window once the animation settles.
      const onSettle = () => {
        embla.off("settle", onSettle);
        setWindowKey(urlKey);
      };
      embla.on("settle", onSettle);
      embla.scrollTo(adjacentIndex, false);
    } else {
      setWindowKey(urlKey);
    }
  }, [urlKey, windowKey, windowPages, embla, reducedMotion]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Whenever the window re-renders, snap the carousel to the current pane.
  useLayoutEffect(() => {
    if (!embla) return;
    embla.scrollTo(startIndex, true);
  }, [embla, windowKey, startIndex]);

  // Preload neighbors so a swipe reveals content, not a skeleton.
  useEffect(() => {
    for (const page of windowPages) {
      if (keyOf(page) !== windowKey) void loadPage(page.path).catch(() => {});
    }
  }, [windowPages, windowKey]);

  // Keyboard page turns (skipped when typing or inside a slideset's scope).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as Element | null;
      if (
        target?.closest(
          "input,textarea,select,[contenteditable=true],[data-swipe-scope]",
        )
      ) {
        return;
      }
      // Resolve from the router's live location: props lag the URL during
      // animated transitions, and rapid keypresses must not be dropped.
      const pathname = stripBase(router.state.location.pathname);
      const splat = pathname.startsWith(`/${locale}/`)
        ? pathname.slice(locale.length + 2)
        : "";
      const resolved = resolveSplat(manifest, decodeURIComponent(splat));
      if (!resolved?.slug) return;
      const current = resolveGlobalPosition(
        manifest,
        resolved.collection,
        resolved.slug,
        view,
      );
      const dest = e.key === "ArrowLeft" ? current?.prev : current?.next;
      if (dest) {
        e.preventDefault();
        void navigate({
          to: "/$locale/$",
          params: { locale, _splat: keyOf(dest) },
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [manifest, router, navigate, locale, view]);

  const windowPage = order[windowIndex];
  const position = windowPage
    ? resolveGlobalPosition(
        manifest,
        windowPage.collection,
        windowPage.slug,
        view,
      )
    : undefined;

  // At a book's last page, name where the swipe continues (the next book).
  const nextBook = useMemo(() => {
    if (!position?.next || position.index !== position.total - 1)
      return undefined;
    if (position.next.collection === position.page.collection) return undefined;
    const next = manifest.collections.find(
      (c) => c.slug === position.next!.collection,
    );
    return next
      ? { label: next.label, href: `/${locale}/${keyOf(position.next)}` }
      : undefined;
  }, [position, manifest, locale]);

  if (!position) return null;

  return (
    <div className="relative h-full">
      {/* Reading progress through the current book, under the header */}
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
              key={keyOf(page)}
              locale={locale}
              page={page}
              position={
                resolveGlobalPosition(
                  manifest,
                  page.collection,
                  page.slug,
                  view,
                ) ?? position
              }
              isCurrent={keyOf(page) === windowKey}
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
