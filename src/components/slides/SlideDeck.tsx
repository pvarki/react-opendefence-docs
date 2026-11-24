import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import type { Slide, SlidesetBlock } from "@shared/content-schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Lightbox } from "@/components/slides/Lightbox";
import { SlideImage } from "@/components/slides/SlideImage";
import { usePreloadImages } from "@/components/slides/useImagePreloader";
import { useDeck } from "@/components/slides/useDeck";
import { useFitText } from "@/components/slides/useFitText";
import { useTextScaleMult } from "@/lib/textScale";

interface SlideDeckProps {
  block: SlidesetBlock;
  /** Only the first slideset on a page binds the ?slide=N search param. */
  bindSlideParam?: boolean;
}

type Enlarged = { src: string; alt?: string };

/**
 * Desktop rendering of a slideset: an Embla deck inside the page swiper.
 * Gesture ownership is one source-level rule: the section is a
 * data-swipe-scope, so the PageSwiper leaves gestures starting here alone —
 * drags, trackpad swipes, buttons and keys drive the deck, and past its
 * first or last slide they continue into the neighbouring page (useDeck).
 *
 * On a guide page the deck is a flex item that fills the rest of the first
 * screen (PagePane); the height below only applies outside one.
 */
export function SlideDeck({ block, bindSlideParam = false }: SlideDeckProps) {
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
    hasNextPage,
    goTo,
    goPrev,
    goNext,
  } = useDeck(count, { bindSlideParam, duration: 25 });
  const [fullscreen, setFullscreen] = useState(false);
  const [enlarged, setEnlarged] = useState<Enlarged>();

  usePreloadImages(
    useMemo(
      () => block.slides.flatMap((s) => s.images.map((i) => i.src)),
      [block],
    ),
  );

  // The whole reader goes fullscreen, not this deck, so it stays fullscreen
  // when a step continues on the next page.
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void sectionRef.current
        ?.closest("[data-reader-root]")
        ?.requestFullscreen()
        .catch(() => {});
    }
  };

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    // The lightbox is modal, but focus stays on the image behind it.
    if (enlarged) return;
    // Space on a focused button is that button's own click.
    if (e.key === " " && e.target !== e.currentTarget) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      goPrev();
    } else if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      goNext();
    } else if (e.key === "f") {
      toggleFullscreen();
    }
  };

  const stepOf = t("slides.stepOf", { current: selected + 1, total: count });
  const prevLabel =
    isFirst && hasPrevPage ? t("reader.previousPage") : t("slides.prevStep");
  const nextLabel =
    isLast && hasNextPage ? t("reader.nextPage") : t("slides.nextStep");

  return (
    <section
      ref={sectionRef}
      data-swipe-scope="slides"
      role="group"
      aria-roledescription="carousel"
      aria-label={block.title}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={cn(
        // A container itself: the control row adapts to the deck's width.
        "@container mt-1 mb-2 flex h-[70dvh] min-h-[min(22rem,60cqh)] flex-[1_1_0px] flex-col rounded-xl border border-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring",
        // Widens into the pane's spare width; PagePane is the container.
        "md:mx-[calc(-1*clamp(0px,(100cqi_-_48rem)/2,10rem))]",
      )}
    >
      {block.title && (
        <h3 className="truncate border-b border-border px-4 py-2 font-semibold">
          {block.title}
        </h3>
      )}

      {/* The track fills the viewport by position: no percentage height has
          to resolve through the flex columns above it. */}
      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 overflow-hidden"
      >
        <div className="absolute inset-0 flex">
          {block.slides.map((slide, i) => (
            <div
              key={i}
              className="h-full min-w-0 flex-[0_0_100%]"
              inert={i !== selected}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
            >
              <SlideContent
                slide={slide}
                fullscreen={fullscreen}
                onEnlarge={setEnlarged}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Narrow decks (a small window, a large text size) drop the button
          labels first, then the dots; the step count always fits. */}
      <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2 @xl:gap-3">
        <Button
          variant="outline"
          size="sm"
          data-step="-1"
          onClick={goPrev}
          disabled={isFirst && !hasPrevPage}
          aria-label={prevLabel}
        >
          <ChevronLeft />
          <span className="hidden @xl:inline">{prevLabel}</span>
        </Button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
          <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {stepOf}
          </p>
          <div
            ref={dotsRef}
            className="relative hidden min-w-0 items-center gap-1.5 overflow-hidden @md:flex"
            role="tablist"
            aria-label={stepOf}
          >
            {block.slides.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === selected}
                aria-label={`${i + 1}`}
                onClick={() => goTo(i)}
                className={cn(
                  "size-2 shrink-0 rounded-full transition-all",
                  i === selected
                    ? "w-5 bg-primary"
                    : "bg-muted hover:bg-muted-foreground",
                )}
              />
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleFullscreen}
          aria-label={
            fullscreen ? t("slides.exitFullscreen") : t("slides.fullscreen")
          }
        >
          {fullscreen ? <Minimize2 /> : <Maximize2 />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-step="1"
          onClick={goNext}
          disabled={isLast && !hasNextPage}
          aria-label={nextLabel}
        >
          <span className="hidden @xl:inline">{nextLabel}</span>
          <ChevronRight />
        </Button>
      </div>

      <Lightbox
        src={enlarged?.src}
        alt={enlarged?.alt}
        onClose={() => setEnlarged(undefined)}
      />
    </section>
  );
}

// Memoized: a slide change re-renders the deck, not every slide's content.
const SlideContent = memo(function SlideContent({
  slide,
  fullscreen,
  onEnlarge,
}: {
  slide: Slide;
  fullscreen: boolean;
  onEnlarge: (image: Enlarged) => void;
}) {
  const image = slide.images[0];
  // Desktop guide slides standardize on image-left/text-right; only the
  // explicit image-right, grid and text layouts deviate.
  const sideBySide =
    !!image && slide.layout !== "grid" && slide.layout !== "text";

  // Image always gets the major golden-ratio column (~62 %). For image-right
  // the children are swapped so we flip the template accordingly.
  const columns =
    slide.layout === "image-right"
      ? "grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)]"
      : "grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)]";

  // The caption scales up to fill its column but is clamped so even the most
  // verbose slide always fits — the slide's height comes from the deck, not
  // from its text, so the fit is stable. Sparse slides grow into bold
  // headlines; fullscreen gets more room. The clamps follow the global
  // text-size control so deck captions scale too.
  const textScale = useTextScaleMult();
  const { boxRef, contentRef, fontSize } = useFitText({
    min: Math.round(13 * textScale),
    max: Math.round((fullscreen ? 24 : 19) * textScale),
  });

  const imageEl = (img: Slide["images"][number]) => (
    <button
      key={img.src}
      type="button"
      className="group relative flex h-full min-h-0 w-full min-w-0 cursor-zoom-in items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onEnlarge({ src: img.src, alt: img.alt })}
    >
      <SlideImage
        image={img}
        fallbackAlt={slide.title}
        className="max-h-full max-w-full rounded-md duration-300"
        spinnerClassName="size-8"
      />
    </button>
  );

  // Auto-fitted caption: the outer box has a definite height and scrolls only
  // as a last resort; the inner wrapper centres the text vertically.
  const caption = (boxClass?: string, contentClass?: string) => (
    <div ref={boxRef} className={cn("min-h-0 overflow-y-auto", boxClass)}>
      <div className="flex min-h-full flex-col justify-center">
        <div
          ref={contentRef}
          className={contentClass}
          style={{ fontSize: `${fontSize}px` }}
        >
          {slide.title && (
            <h4 className="mb-3 text-[1.25em] leading-tight font-semibold text-balance">
              {slide.title}
            </h4>
          )}
          <div
            style={{ fontSize: "inherit" }}
            className="slide-prose prose prose-invert max-w-none leading-snug"
            dangerouslySetInnerHTML={{ __html: slide.html }}
          />
        </div>
      </div>
    </div>
  );

  // Legacy / unused layout: a grid of images above a plain caption. Kept for
  // safety (no slide currently authors it) without the fit machinery.
  if (slide.layout === "grid") {
    return (
      <div className="h-full space-y-4 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3">
          {slide.images.map(imageEl)}
        </div>
        <div>
          {slide.title && <h4 className="mb-2 font-semibold">{slide.title}</h4>}
          <div
            className="slide-prose prose prose-invert max-w-none text-sm"
            dangerouslySetInnerHTML={{ __html: slide.html }}
          />
        </div>
      </div>
    );
  }

  if (sideBySide) {
    return (
      <div
        className={cn(
          // PowerPoint-style split: image panel left, caption right, divided on
          // the golden ratio — the major column goes to the image or the text
          // depending on the screenshot's orientation (see `columns`).
          "grid h-full grid-rows-[minmax(0,1fr)] items-stretch gap-6 p-4 md:gap-8 md:p-6",
          columns,
        )}
      >
        {slide.layout === "image-right" ? (
          <>
            {caption("min-w-0")}
            {imageEl(image)}
          </>
        ) : (
          <>
            {imageEl(image)}
            {caption("min-w-0")}
          </>
        )}
      </div>
    );
  }

  // Text-only slide: a centred, measure-constrained block — reads like a
  // section title card rather than a wall of full-width text.
  return (
    <div className="flex h-full flex-col p-4 md:p-8">
      {caption("w-full flex-1", "mx-auto max-w-[55ch]")}
    </div>
  );
});
