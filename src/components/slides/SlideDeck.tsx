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

  const imageEl = (img: {
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  }) => (
    <button
      key={img.src}
      type="button"
      className="relative block w-full"
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
          "w-full rounded-lg border border-border bg-muted/20 object-contain transition-opacity duration-300",
          fullscreen ? "max-h-[60dvh]" : "max-h-[45dvh]",
          imageLoaded(img.src) ? "opacity-100" : "opacity-0",
        )}
      />
    </button>
  );

  const caption = (
    <div>
      {slide.title && <h4 className="mb-2 font-semibold">{slide.title}</h4>}
      <div
        className="prose prose-invert max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: slide.html }}
      />
    </div>
  );

  return (
    <div
      className={cn(
        "p-4 md:p-6",
        sideBySide && "grid items-start gap-6 md:grid-cols-2",
      )}
    >
      {slide.layout === "image-right" ? (
        <>
          {caption}
          {image && imageEl(image)}
        </>
      ) : slide.layout === "grid" ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            {slide.images.map(imageEl)}
          </div>
          {caption}
        </>
      ) : (
        <>
          {image && slide.layout !== "text" && (
            <div className={cn(!sideBySide && "mb-4")}>{imageEl(image)}</div>
          )}
          {caption}
        </>
      )}
    </div>
  );
}
