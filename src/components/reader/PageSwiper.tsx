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
import { useTranslation } from "react-i18next";
import type { LocaleManifest, ManifestPage } from "@shared/content-schema";
import type { ReadingView } from "@/lib/platform";
import { loadPage } from "@/lib/content/loader";
import {
  bookPositions,
  nextBook,
  resolveSplat,
  type PagePosition,
} from "@/lib/content/neighbors";
import { pageSwiperOptions } from "@/components/reader/emblaPageOptions";
import { stripBase } from "@/lib/base";
import { onWheelSwipe } from "@/lib/wheelSwipe";
import { PagePane } from "@/components/reader/PagePane";
import type { SlideParam } from "@/components/reader/paneContext";
import { useReducedMotion } from "@/components/reader/useReducedMotion";

interface PageSwiperProps {
  locale: string;
  manifest: LocaleManifest;
  collection: string;
  slug: string;
  /** Active view (platform + per-book clients): the swipe order covers it start to finish. */
  view?: ReadingView;
  /** The URL's `?slide=`, handed to the current page's slideset. */
  slide?: SlideParam;
}

/** Slugs are unique per collection only — slots key on both. */
const keyOf = (page: ManifestPage) => `${page.collection}/${page.slug}`;

/** A press that moved the strip less than this is a click, not a swipe. */
const TAP_SLOP_PX = 10;

/** A page turn has played out by now; its page's new neighbour mounts then. */
const TURN_MS = 700;

/**
 * Book-like swipe navigation through one book, in the active platform's
 * reading order. Page turns stop at the book's ends: the way into another
 * book is a link (the card under a book's last page), never a swipe.
 */
export function PageSwiper({
  locale,
  manifest,
  collection,
  slug,
  view,
  slide,
}: PageSwiperProps) {
  const positions = useMemo(
    () => bookPositions(manifest, collection, view),
    [manifest, collection, view],
  );
  const onward = useMemo(() => {
    const book = nextBook(manifest, collection, view);
    return book && { label: book.label, href: `/${locale}/${book.slug}` };
  }, [manifest, collection, view, locale]);
  const urlIndex = positions.findIndex(({ page }) => page.slug === slug);
  // A deep link into another platform's page, until the route switches view.
  if (urlIndex === -1) return null;

  return (
    <PageStrip
      key={collection} // another book is another strip
      locale={locale}
      manifest={manifest}
      positions={positions}
      urlIndex={urlIndex}
      slide={slide}
      nextBook={onward}
    />
  );
}

/**
 * One slot per page of the book, laid out as a single strip that the
 * carousel scrolls; only the pages next to the reader are mounted in their
 * slots. The slots never move, so there is no window to shift and nothing
 * waits for an animation to end. The URL is the single source of truth:
 * - the URL's page is the current, interactive one from the moment it changes;
 *   the carousel follows it — a page turn to a neighbour, a cut otherwise;
 * - a swipe that ends on another page commits a history push (so OS
 *   back-gestures land on the previous page — the only sane behavior on iOS
 *   standalone).
 */
function PageStrip({
  locale,
  manifest,
  positions,
  urlIndex,
  slide,
  nextBook,
}: {
  locale: string;
  manifest: LocaleManifest;
  positions: PagePosition[];
  urlIndex: number;
  slide?: SlideParam;
  /** Where the card under the book's last page leads. */
  nextBook?: { label: string; href: string };
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  // Mounted: the URL's page, the page a turn is leaving, and the pages next
  // to where the reader has settled. Those follow only once a turn has played
  // out (a page mounting in the middle of one stalls it) or a drag begins.
  const [turn, setTurn] = useState({ at: urlIndex, from: urlIndex });
  if (turn.at !== urlIndex) setTurn({ at: urlIndex, from: turn.at });
  const [nearIndex, setNearIndex] = useState(urlIndex);
  useEffect(() => {
    const timer = setTimeout(() => setNearIndex(urlIndex), TURN_MS);
    return () => clearTimeout(timer);
  }, [urlIndex]);

  const [options] = useState(() => pageSwiperOptions(urlIndex));
  const [viewportRef, embla] = useEmblaCarousel(options);

  // The carousel's handlers outlive renders; they read the route from here.
  const live = useRef({ positions, urlIndex, reducedMotion });
  useLayoutEffect(() => {
    live.current = { positions, urlIndex, reducedMotion };
  });

  // The page a swipe left the carousel on, until the URL has caught up.
  const swipedTo = useRef<number>(undefined);

  const go = useCallback(
    (splat: string) =>
      navigate({ to: "/$locale/$", params: { locale, _splat: splat } }),
    [navigate, locale],
  );

  // A slideset's Previous/Next button walks on into the neighbouring page.
  // That page is cut to, not turned to: the button the reader keeps pressing
  // must be back under the pointer at once, not gliding past it.
  const cutTo = useRef<string>(undefined);
  const step = useCallback(
    (from: PagePosition, dir: 1 | -1, cut: boolean) => {
      const dest = dir === 1 ? from.next : from.prev;
      if (!dest) return;
      const splat = keyOf(dest);
      if (cut) cutTo.current = splat;
      void navigate({
        to: "/$locale/$",
        params: { locale, _splat: splat },
        search: dir === -1 ? { slide: "last" } : {},
      });
    },
    [navigate, locale],
  );

  const showUrlPage = useCallback(
    (cut = false) => {
      if (!embla) return;
      const { urlIndex, reducedMotion } = live.current;
      const shown = embla.selectedScrollSnap();
      // Already there — or a newer swipe is ahead of a URL still catching up.
      if (shown === urlIndex || shown === swipedTo.current) return;
      // Where the strip is, in slots. A turn starts from next door only: from
      // further away (quick presses outrun the animation) it would glide
      // across slots that are not mounted.
      const at = embla.scrollProgress() * (embla.scrollSnapList().length - 1);
      embla.scrollTo(
        urlIndex,
        cut || reducedMotion || Math.abs(at - urlIndex) > 1.01,
      );
    },
    [embla],
  );

  // The slots follow the reading order: a platform switch replaces them.
  const strip = useRef(positions);
  useLayoutEffect(() => {
    if (!embla || strip.current === positions) return;
    strip.current = positions;
    embla.reInit({ startIndex: urlIndex });
  }, [embla, positions, urlIndex]);

  // URL -> carousel.
  useLayoutEffect(() => {
    if (swipedTo.current === urlIndex) swipedTo.current = undefined;
    showUrlPage(cutTo.current === keyOf(positions[urlIndex].page));
    cutTo.current = undefined;
  }, [urlIndex, positions, showUrlPage]);

  // Carousel -> URL: only a finger or mouse drag ends in "pointerUp", so the
  // carousel's own page turns can never navigate.
  useEffect(() => {
    if (!embla) return;
    let downAt = 0;
    const onPointerDown = () => {
      downAt = embla.internalEngine().location.get();
      setNearIndex(live.current.urlIndex); // a drag may reveal either side now
    };
    const onPointerUp = () => {
      const { positions, urlIndex } = live.current;
      const moved = embla.internalEngine().location.get() - downAt;
      if (Math.abs(moved) < TAP_SLOP_PX) {
        // A click froze a page that was still sliding in: finish the turn.
        embla.scrollTo(swipedTo.current ?? urlIndex);
        return;
      }
      const shown = embla.selectedScrollSnap();
      const to = positions[shown]?.page;
      if (!to || shown === urlIndex) return;
      if (shown - urlIndex > 0 !== moved < 0) {
        // The drag caught a page turn early and was too gentle to carry on:
        // the carousel fell back to the page being left, against the drag.
        embla.scrollTo(urlIndex);
        return;
      }
      swipedTo.current = shown;
      void go(keyOf(to)).finally(() => {
        // Wherever that ended up (a redirect, a newer click), the URL wins.
        if (swipedTo.current !== shown) return;
        swipedTo.current = undefined;
        showUrlPage();
      });
    };
    embla.on("pointerDown", onPointerDown).on("pointerUp", onPointerUp);
    return () => {
      embla.off("pointerDown", onPointerDown).off("pointerUp", onPointerUp);
    };
  }, [embla, go, showUrlPage]);

  // A trackpad swipe turns one page.
  useEffect(() => {
    if (!embla) return;
    return onWheelSwipe(embla.rootNode(), (dir) => {
      const { positions, urlIndex } = live.current;
      const { next, prev } = positions[urlIndex];
      const dest = dir === 1 ? next : prev;
      if (dest) void go(keyOf(dest));
    });
  }, [embla, go]);

  // Preload neighbors so a swipe reveals content, not a skeleton.
  useEffect(() => {
    for (const neighbor of [positions[urlIndex - 1], positions[urlIndex + 1]]) {
      if (neighbor) void loadPage(neighbor.page.path).catch(() => {});
    }
  }, [positions, urlIndex]);

  // Keyboard page turns (skipped when typing or inside a slideset's scope).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      // An open menu, select, dialog or sheet owns the arrows — also when
      // the focus is not inside it (the lightbox leaves it on the page).
      if (e.defaultPrevented) return;
      if (document.querySelector("[role=dialog][data-state=open]")) return;
      const target = e.target as Element | null;
      if (
        target?.closest(
          "input,textarea,select,[contenteditable=true],[data-swipe-scope],[role=listbox],[role=menu],[role=radiogroup],[role=dialog]",
        )
      ) {
        return;
      }
      // Step from the router's live location, not from props: every press of
      // a held key turns one page, even while the last turn is committing.
      const pathname = stripBase(router.state.location.pathname);
      const splat = pathname.startsWith(`/${locale}/`)
        ? pathname.slice(locale.length + 2)
        : "";
      const at = resolveSplat(manifest, decodeURIComponent(splat));
      const from = live.current.positions.find(
        ({ page }) =>
          page.collection === at?.collection && page.slug === at.slug,
      );
      const dest = e.key === "ArrowRight" ? from?.next : from?.prev;
      if (!dest) return;
      e.preventDefault();
      void go(keyOf(dest));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [manifest, router, locale, go]);

  // Every page of these books is a step guide (a slideset).
  const guideBooks = useMemo(
    () =>
      new Set(
        manifest.collections
          .filter((c) => c.section === "deploy-app" || c.section === "guides")
          .map((c) => c.slug),
      ),
    [manifest],
  );
  const current = positions[urlIndex];

  return (
    <div data-reader-root className="relative h-full bg-background">
      {/* Reading progress through the current book, under the header */}
      <div className="absolute inset-x-0 top-0 z-10 h-0.5 bg-muted">
        <div
          data-testid="reading-progress"
          className="h-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${((current.index + 1) / current.total) * 100}%` }}
        />
      </div>

      <div ref={viewportRef} className="h-full touch-pan-y overflow-hidden">
        <div className="flex h-full">
          {positions.map((position, i) => {
            const { page } = position;
            const isCurrent = i === urlIndex;
            // Neighbor panes are mounted for the swipe reveal but inert —
            // their links and headings stay out of the tab order and
            // accessibility tree.
            return (
              <div
                key={keyOf(page)}
                className="min-w-0 flex-[0_0_100%]"
                inert={!isCurrent}
                data-current={isCurrent || undefined}
              >
                {(isCurrent ||
                  i === turn.from ||
                  Math.abs(i - nearIndex) <= 1) && (
                  <PagePane
                    locale={locale}
                    position={position}
                    isCurrent={isCurrent}
                    slide={isCurrent ? slide : undefined}
                    onStep={step}
                    likelyGuide={guideBooks.has(page.collection)}
                    nextBook={i === positions.length - 1 ? nextBook : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <span aria-live="polite" className="sr-only">
        {t("reader.pageAnnouncement", {
          title: current.page.title,
          current: current.index + 1,
          total: current.total,
        })}
      </span>
    </div>
  );
}
