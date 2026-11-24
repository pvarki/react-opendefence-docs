import { memo, useEffect, useMemo, useState } from "react";
import type { ManifestPage, PageDoc } from "@shared/content-schema";
import type { PagePosition } from "@/lib/content/neighbors";
import { loadPage, peekPage } from "@/lib/content/loader";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { UnderConstructionBanner } from "@/components/reader/UnderConstructionBanner";
import { PrevNextBar } from "@/components/reader/PrevNextBar";
import { EndOfBookCard } from "@/components/reader/EndOfBookCard";
import { PageFooter } from "@/components/reader/PageFooter";
import { PaneContext, type SlideParam } from "@/components/reader/paneContext";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { Skeleton } from "@/components/ui/skeleton";
import { useScrollMemory } from "@/components/reader/useScrollMemory";

function usePageDoc(page: ManifestPage): PageDoc | undefined {
  // Usually loaded already (the swiper preloads neighbors): no skeleton frame.
  const [doc, setDoc] = useState(() => peekPage(page.path));

  // Panes are keyed by slug, so page.path is stable for this instance's
  // lifetime — no stale-doc reset needed before the (usually cached) load.
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
  }, [page.path]);

  return doc;
}

interface PagePaneProps {
  locale: string;
  position: PagePosition;
  isCurrent: boolean;
  slide?: SlideParam;
  /** A slideset of this page walks on into the neighbouring page. */
  onStep: (from: PagePosition, dir: 1 | -1, cut: boolean) => void;
  /** Set on a book's last page: the book the swipe continues into. */
  nextBookLabel?: string;
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
  nextBookLabel,
}: PagePaneProps) {
  const { page, next } = position;
  const doc = usePageDoc(page);
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

  return (
    <PaneContext value={pane}>
      <div
        ref={scrollRef}
        data-page-scroll
        tabIndex={-1}
        className="@container h-full overflow-y-auto overscroll-y-contain px-4 outline-none md:px-8"
      >
        <article className="mx-auto max-w-3xl py-2 md:py-8">
          <h1 className="mb-2 text-xl font-bold md:mb-6 md:text-3xl">
            {page.title}
          </h1>
          {(page.underDevelopment || doc?.underDevelopment) && (
            <UnderConstructionBanner />
          )}
          {doc ? (
            <BlockRenderer blocks={doc.blocks} />
          ) : (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}
          <PrevNextBar locale={locale} position={position} />
          {next && nextBookLabel && (
            <EndOfBookCard
              nextBook={{
                label: nextBookLabel,
                href: `/${locale}/${next.collection}`,
              }}
            />
          )}
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
