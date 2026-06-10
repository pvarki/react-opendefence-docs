import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ManifestPage, PageDoc } from "@shared/content-schema";
import type { PagePosition } from "@/lib/content/neighbors";
import { loadPage } from "@/lib/content/loader";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { PrevNextBar } from "@/components/reader/PrevNextBar";
import { EndOfBookCard } from "@/components/reader/EndOfBookCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useScrollMemory } from "@/components/reader/useScrollMemory";

function usePageDoc(page: ManifestPage): PageDoc | undefined {
  const [doc, setDoc] = useState<PageDoc>();

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
  page: ManifestPage;
  position: PagePosition;
  isCurrent: boolean;
  nextBook?: { label: string; href: string };
}

/**
 * One pane of the PageSwiper: owns its vertical scroll (the horizontal track
 * never scrolls vertically) and remembers its scroll position per slug.
 * Neighbor panes are mounted for the swipe reveal but inert — their links
 * and headings stay out of the tab order and accessibility tree.
 */
export function PagePane({
  locale,
  page,
  position,
  isCurrent,
  nextBook,
}: PagePaneProps) {
  const { t } = useTranslation();
  const doc = usePageDoc(page);
  const scrollRef = useScrollMemory(
    `${locale}:${page.collection}:${page.slug}`,
  );
  const isLast = position.index === position.total - 1;

  return (
    <div
      className="min-w-0 flex-[0_0_100%]"
      inert={!isCurrent}
      data-current={isCurrent || undefined}
    >
      <div
        ref={scrollRef}
        data-page-scroll
        tabIndex={-1}
        className="h-[calc(100dvh-var(--header-h)-var(--tabbar-h))] overflow-y-auto overscroll-y-contain px-4 outline-none md:px-8"
      >
        <article className="mx-auto max-w-3xl py-8">
          <h1 className="mb-6 text-3xl font-bold">{page.title}</h1>
          {doc ? (
            doc.underDevelopment ? (
              <p className="rounded-lg border border-border bg-card px-4 py-6 text-muted-foreground">
                {t("reader.comingSoon")}
              </p>
            ) : (
              <BlockRenderer blocks={doc.blocks} />
            )
          ) : (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}
          <PrevNextBar locale={locale} position={position} />
          {isLast && nextBook && <EndOfBookCard nextBook={nextBook} />}
        </article>
      </div>
    </div>
  );
}
