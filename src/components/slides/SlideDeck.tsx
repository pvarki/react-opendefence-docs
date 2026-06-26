import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import type { Slide, SlidesetBlock } from "@shared/content-schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Lightbox } from "@/components/slides/Lightbox";
import { useImagePreloader } from "@/components/slides/useImagePreloader";
import { useEdgePageFlow } from "@/components/slides/useEdgePageFlow";
import { useFitText } from "@/components/slides/useFitText";
import { useReaderData } from "@/lib/useReaderData";
import { useReadingView } from "@/lib/platform";
import { resolveGlobalPosition } from "@/lib/content/neighbors";

interface SlideDeckProps {
  block: SlidesetBlock;
  /** Only the first slideset on a page binds the ?slide=N search param. */
  bindSlideParam?: boolean;
}

/**
 * Desktop rendering of a slideset: an Embla deck inside the page swiper.
 * Gesture ownership is one source-level rule: the section is a
 * data-swipe-scope, so the PageSwiper's watchDrag rejects gestures starting
 * here. The deck deliberately has no wheel plugin — trackpad swipes always
 * turn the page, drags/buttons/keys drive the deck.
 */
export function SlideDeck({ block, bindSlideParam = false }: SlideDeckProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const reader = useReaderData();
  const view = useReadingView();
  const search = useSearch({ strict: false }) as { slide?: number };
  const sectionRef = useRef<HTMLElement>(null);

  const initialSlide = bindSlideParam && search.slide ? search.slide - 1 : 0;
  const [selected, setSelected] = useState(() =>
    Math.min(Math.max(initialSlide, 0), block.slides.length - 1),
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [enlarged, setEnlarged] = useState<{ src: string; alt?: string }>();

  const [viewportRef, embla] = useEmblaCarousel({
    axis: "x",
    align: "start",
    containScroll: "trimSnaps",
    skipSnaps: false,
    duration: 25,
    startIndex: selected,
    watchFocus: false,
  });

  const allImageSrcs = block.slides.flatMap((s) => s.images.map((i) => i.src));
  const preloader = useImagePreloader(allImageSrcs);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => {
      const index = embla.selectedScrollSnap();
      setSelected(index);
      if (bindSlideParam) {
        void navigate({
          to: ".",
          search: (prev: Record<string, unknown>) => ({
            ...prev,
            slide: index + 1,
          }),
          replace: true,
        });
      }
    };
    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla, bindSlideParam, navigate]);

  const goTo = useCallback((index: number) => embla?.scrollTo(index), [embla]);

  // Dragging past the deck's edges continues through the book, exactly like
  // the mobile show — the deck never dead-ends the reading flow.
  const position =
    reader?.slug !== undefined
      ? resolveGlobalPosition(
          reader.manifest,
          reader.collection,
          reader.slug,
          view,
        )
      : undefined;
  const goToPage = useCallback(
    (page: { collection: string; slug: string } | undefined) => {
      if (!page || !params.locale) return;
      void navigate({
        to: "/$locale/$",
        params: {
          locale: params.locale,
          _splat: `${page.collection}/${page.slug}`,
        },
      });
    },
    [navigate, params.locale],
  );
  const isLast = selected === block.slides.length - 1;
  // Forward from the last slide continues into the next chapter, so the Next
  // button never dead-ends — same flow as the drag-past-edge gesture below.
  const goForward = () => {
    if (!isLast) embla?.scrollNext();
    else goToPage(position?.next);
  };
  useEdgePageFlow(embla, {
    isFirst: selected === 0,
    isLast,
    onNextPage: () => goToPage(position?.next),
    onPrevPage: () => goToPage(position?.prev),
  });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      embla?.scrollPrev();
    } else if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      embla?.scrollNext();
    } else if (e.key === "f") {
      void toggleFullscreen();
    }
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    } else {
      await sectionRef.current?.requestFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

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
        "my-8 rounded-xl border border-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring",
        fullscreen &&
          "flex h-full flex-col justify-center rounded-none bg-background",
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          {block.title && (
            <h3 className="truncate font-semibold">{block.title}</h3>
          )}
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("slides.stepOf", {
              current: selected + 1,
              total: block.slides.length,
            })}
            {preloader.loadedCount < preloader.total &&
              ` · ${preloader.loadedCount}/${preloader.total}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void toggleFullscreen()}
          aria-label={
            fullscreen ? t("slides.exitFullscreen") : t("slides.fullscreen")
          }
        >
          {fullscreen ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </div>

      <div ref={viewportRef} className="overflow-hidden">
        <div className="flex">
          {block.slides.map((slide, i) => (
            <div
              key={i}
              className="min-w-0 flex-[0_0_100%]"
              inert={i !== selected}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${block.slides.length}`}
            >
              <SlideContent
                slide={slide}
                fullscreen={fullscreen}
                imageLoaded={preloader.isLoaded}
                onEnlarge={(src, alt) => setEnlarged({ src, alt })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => embla?.scrollPrev()}
          disabled={selected === 0}
        >
          <ChevronLeft />
          {t("reader.previous")}
        </Button>
        <div className="flex items-center gap-1.5" role="tablist">
          {block.slides.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === selected}
              aria-label={`${i + 1}`}
              onClick={() => goTo(i)}
              className={cn(
                "size-2 rounded-full transition-all",
                i === selected
                  ? "w-5 bg-primary"
                  : "bg-muted hover:bg-muted-foreground",
              )}
            />
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={goForward}
          disabled={isLast && !position?.next}
        >
          {isLast && position?.next ? t("reader.nextPage") : t("reader.next")}
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

function SlideContent({
  slide,
  fullscreen,
  imageLoaded,
  onEnlarge,
}: {
  slide: Slide;
  fullscreen: boolean;
  imageLoaded: (src: string) => boolean;
  onEnlarge: (src: string, alt?: string) => void;
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
  // verbose slide always fits — the box owns a fixed height, so the fit is
  // stable. Sparse slides grow into bold headlines; fullscreen gets more room.
  const { boxRef, contentRef, fontSize } = useFitText({
    min: 13,
    max: fullscreen ? 24 : 19,
  });

  const imageEl = (img: {
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  }) => (
    <button
      key={img.src}
      type="button"
      className="group relative flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/20 p-3 transition-colors hover:border-primary/40 md:p-4"
      onClick={() => onEnlarge(img.src, img.alt)}
    >
      {!imageLoaded(img.src) && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </span>
      )}
      <img
        src={img.src}
        alt={img.alt ?? slide.title ?? ""}
        width={img.width}
        height={img.height}
        className={cn(
          "max-h-full max-w-full rounded-md object-contain transition-opacity duration-300",
          imageLoaded(img.src) ? "opacity-100" : "opacity-0",
        )}
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

  // A fixed slide height keeps the deck uniform and gives the caption a stable
  // box to fit into. Tall enough that even the most verbose caption in the
  // corpus fits without scrolling; fullscreen gets the taller frame.
  const frame = fullscreen ? "h-[72dvh]" : "h-[62dvh] min-h-[420px]";

  // Legacy / unused layout: a grid of images above a plain caption. Kept for
  // safety (no slide currently authors it) without the fit machinery.
  if (slide.layout === "grid") {
    return (
      <div className="space-y-4 p-4 md:p-6">
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
          "grid items-stretch gap-6 p-4 md:gap-8 md:p-6",
          columns,
          frame,
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
    <div className={cn("flex flex-col p-4 md:p-8", frame)}>
      {caption("w-full flex-1", "mx-auto max-w-[55ch]")}
    </div>
  );
}
