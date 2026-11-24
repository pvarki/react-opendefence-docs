import { memo, useEffect, useMemo, useState } from "react";
import type { ManifestPage, PageDoc } from "@shared/content-schema";
import type { PagePosition } from "@/lib/content/neighbors";
import { loadPage, peekPage } from "@/lib/content/loader";
import { cn } from "@/lib/utils";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { UnderConstructionBanner } from "@/components/reader/UnderConstructionBanner";
import { PrevNextBar } from "@/components/reader/PrevNextBar";
import { EndOfBookCard } from "@/components/reader/EndOfBookCard";
import { PageFooter } from "@/components/reader/PageFooter";
import { PaneContext, type SlideParam } from "@/components/reader/paneContext";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { Skeleton } from "@/components/ui/skeleton";
import { useScrollMemory } from "@/components/reader/useScrollMemory";

function usePageDoc(
  page: ManifestPage,
  isCurrent: boolean,
): PageDoc | undefined {
  // Usually loaded already (the swiper preloads neighbors): no skeleton frame.
  const [doc, setDoc] = useState(() => peekPage(page.path));

  // Panes are keyed by slug, so page.path is stable for this instance's
  // lifetime — no stale-doc reset needed before the (usually cached) load.
  // Runs again when the pane becomes the current one: turning to a page
  // whose load failed retries it.
  useEffect(() => {
    let cancelled = false;
    loadPage(page.path)
      .then((loaded) => {
        if (!cancelled) setDoc(loaded);
      })
      .catch(() => {
        // Pane stays on skeleton; navigation remains possible throughout.
      });
    return () => {
      cancelled = true;
    };
  }, [page.path, isCurrent]);

  return doc;
}

interface PagePaneProps {
  locale: string;
  position: PagePosition;
  isCurrent: boolean;
  slide?: SlideParam;
  /** A slideset of this page walks on into the neighbouring page. */
  onStep: (from: PagePosition, dir: 1 | -1, cut: boolean) => void;
  /** Set on a book's last page: the book to read next. */
  nextBook?: { label: string; href: string };
  /** The page's book holds step guides: how to lay out before the doc is in. */
  likelyGuide?: boolean;
}

/**
 * One page of the PageSwiper: owns its vertical scroll (the horizontal track
 * never scrolls vertically) and remembers its scroll position per slug.
 */
export const PagePane = memo(function PagePane({
  locale,
  position,
  isCurrent,
  slide,
  onStep,
  nextBook,
  likelyGuide = false,
}: PagePaneProps) {
  const { page } = position;
  const doc = usePageDoc(page, isCurrent);
  const scrollRef = useScrollMemory(
    `${locale}:${page.collection}:${page.slug}`,
    !!doc,
  );
  const pane = useMemo(
    () => ({
      locale,
      position,
      isCurrent,
      slide,
      step: (dir: 1 | -1, cut: boolean) => onStep(position, dir, cut),
    }),
    [locale, position, isCurrent, slide, onStep],
  );

  // A step guide: title, intro and slideset share the first screen, the
  // slideset taking whatever height is left of it.
  const deckAt = doc ? doc.blocks.findIndex((b) => b.type === "slideset") : -1;
  const isGuide = doc ? deckAt !== -1 : likelyGuide;

  return (
    <PaneContext value={pane}>
      <div
        ref={scrollRef}
        data-page-scroll
        tabIndex={-1}
        // A size container: 100cqh is one screen of this pane, and slidesets
        // widen into its spare width with cqi.
        className="h-full overflow-y-auto overscroll-y-contain px-4 outline-none [container-type:size] md:px-8"
      >
        <article className="mx-auto max-w-3xl pb-2 md:pb-8">
          <div
            className={cn(
              "pt-2",
              // At least one screen: what cannot fit makes the column grow and
              // the page scroll. Nothing but the slideset gives way.
              isGuide
                ? "flex min-h-[100cqh] flex-col *:shrink-0 md:pt-3"
                : "md:pt-8",
            )}
          >
            <h1
              className={cn(
                "font-bold",
                isGuide
                  ? "mb-1.5 text-lg leading-snug md:mb-2 md:text-2xl"
                  : "mb-2 text-xl md:mb-6 md:text-3xl",
              )}
            >
              {page.title}
            </h1>
            {(page.underDevelopment || doc?.underDevelopment) && (
              <UnderConstructionBanner size={isGuide ? "line" : "full"} />
            )}
            {doc ? (
              <BlockRenderer
                blocks={isGuide ? doc.blocks.slice(0, deckAt + 1) : doc.blocks}
              />
            ) : isGuide ? (
              <Skeleton
                className="mt-1 mb-2 min-h-80 flex-1 rounded-xl"
                aria-busy="true"
              />
            ) : (
              <div className="space-y-3" aria-busy="true">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}
          </div>
          {doc && isGuide && (
            <BlockRenderer
              blocks={doc.blocks.slice(deckAt + 1)}
              bindSlideParam={false}
            />
          )}
          <PrevNextBar locale={locale} position={position} />
          {nextBook && <EndOfBookCard nextBook={nextBook} />}
          <PageFooter
            collection={page.collection}
            title={page.title}
            docId={page.id}
          />
          <SiteFooter compact />
        </article>
      </div>
    </PaneContext>
  );
});
