import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Maximize2,
} from "lucide-react";
import type { SlidesetBlock } from "@shared/content-schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Lightbox } from "@/components/slides/Lightbox";
import { SlideImage } from "@/components/slides/SlideImage";
import { usePreloadImages } from "@/components/slides/useImagePreloader";
import { useDeck } from "@/components/slides/useDeck";
import { IS_STANDALONE } from "@/lib/standalone";
import { useIsLargeText } from "@/lib/textScale";

/**
 * Mobile slideshow — the primary guide surface. On a guide page it fills the
 * rest of the first screen below the title (PagePane), so image AND caption
 * are visible at one glance: the image takes the flexible space, the caption
 * a bounded strip below it. Swipes inside the deck (data-swipe-scope) turn
 * slides, never the page; stepping past the last or first slide continues on
 * the neighbouring page (useDeck), so the flow never dead-ends.
 */
export function MobileSlideShow({
  block,
  bindSlideParam = false,
}: {
  block: SlidesetBlock;
  bindSlideParam?: boolean;
}) {
  const { t } = useTranslation();
  const count = block.slides.length;
  const {
    sectionRef,
    viewportRef,
    dotsRef,
    selected,
    isFirst,
    isLast,
    hasPrevPage,
    hasNextPage: nextPage,
    goTo,
    goPrev,
    goNext,
    skip,
  } = useDeck(count, { bindSlideParam, duration: 22 });

  const [enlarged, setEnlarged] = useState<{ src: string; alt?: string }>();
  // At large text steps, shrink the image so the (now bigger) caption fits, and
  // surface an explicit "Enlarge the image" button instead of tap-anywhere.
  const largeText = useIsLargeText();

  usePreloadImages(
    useMemo(
      () => block.slides.flatMap((s) => s.images.map((i) => i.src)),
      [block],
    ),
  );

  return (
    <section
      ref={sectionRef}
      data-swipe-scope="slides"
      role="group"
      aria-roledescription="carousel"
      aria-label={block.title}
      className="mt-1 mb-2 flex h-[calc(100dvh-var(--header-h)-var(--tabbar-h)-4.5rem)] min-h-[min(17rem,60cqh)] flex-[1_1_0px] flex-col overflow-hidden rounded-xl border border-border bg-card"
    >
      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 touch-pan-y overflow-hidden"
      >
        {/* Fills the viewport by position, not by a percentage height. */}
        <div className="absolute inset-0 flex">
          {block.slides.map((slide, i) => (
            <div
              key={i}
              inert={i !== selected}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              className="flex h-full min-w-0 flex-[0_0_100%] flex-col"
            >
              {slide.images[0] && (
                <div
                  className={cn(
                    "relative bg-muted/20 p-2",
                    largeText ? "h-28 shrink-0" : "min-h-0 flex-1",
                  )}
                >
                  <SlideImage
                    image={slide.images[0]}
                    fallbackAlt={slide.title}
                    className="h-full w-full duration-200"
                    spinnerClassName="size-7"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEnlarged({
                        src: slide.images[0].src,
                        alt: slide.images[0].alt,
                      })
                    }
                    aria-label={t("slides.enlarge")}
                    className={cn(
                      "absolute outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      largeText
                        ? "top-3 left-3 flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white"
                        : "inset-0 flex items-start justify-end p-2",
                    )}
                  >
                    {largeText ? (
                      <>
                        <Maximize2 className="size-3.5" />
                        {t("slides.enlarge")}
                      </>
                    ) : (
                      <span className="rounded-md bg-black/50 p-1.5 text-white opacity-70">
                        <Maximize2 className="size-4" />
                      </span>
                    )}
                  </button>
                </div>
              )}
              <div
                className={cn(
                  "overflow-y-auto border-t border-border px-3 py-2",
                  !slide.images[0] || largeText
                    ? "min-h-0 flex-1"
                    : "max-h-[50%] shrink-0",
                )}
              >
                {slide.title && (
                  <h4 className="mb-1 text-sm font-semibold">{slide.title}</h4>
                )}
                <div
                  className="slide-prose prose prose-invert max-w-none text-[0.8125rem] leading-snug"
                  dangerouslySetInnerHTML={{ __html: slide.html }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-2 border-t border-border px-2 py-1.5",
          // The installed app's floating Back button (TabBar) sits over this
          // corner: keep Previous clear of it.
          IS_STANDALONE && "pl-14",
        )}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          data-step="-1"
          onClick={goPrev}
          disabled={isFirst && !hasPrevPage}
          aria-label={isFirst ? t("reader.previousPage") : t("slides.prevStep")}
        >
          <ChevronLeft />
        </Button>
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
            {selected + 1}/{count}
          </span>
          <div
            ref={dotsRef}
            className="relative flex items-center gap-1 overflow-hidden"
          >
            {block.slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${i + 1}`}
                onClick={() => goTo(i)}
                className={cn(
                  "size-1.5 shrink-0 rounded-full transition-all",
                  i === selected ? "w-4 bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isLast && nextPage && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-0.5 px-2 text-xs text-muted-foreground"
              onClick={skip}
              aria-label={t("slides.skipToNextPage")}
            >
              {t("slides.skip")}
              <ChevronsRight className="size-3.5" />
            </Button>
          )}
          {/* The same size and spot on every slide: the reader walks the
              book by tapping here, and Skip must never slide under that tap. */}
          <Button
            variant={isLast && nextPage ? "default" : "outline"}
            size="sm"
            className="size-8 px-0"
            data-step="1"
            onClick={goNext}
            disabled={isLast && !nextPage}
            aria-label={isLast ? t("reader.nextPage") : t("slides.nextStep")}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <Lightbox
        src={enlarged?.src}
        alt={enlarged?.alt}
        onClose={() => setEnlarged(undefined)}
      />
    </section>
  );
}
