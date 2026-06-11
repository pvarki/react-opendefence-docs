import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SlidesetBlock } from "@shared/content-schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Lightbox } from "@/components/slides/Lightbox";
import { useImagePreloader } from "@/components/slides/useImagePreloader";
import { useReaderData } from "@/lib/useReaderData";
import { usePlatform } from "@/lib/platform";
import { resolveGlobalPosition } from "@/lib/content/neighbors";

/**
 * Mobile slideshow — the primary guide surface. Occupies the viewport below
 * the title so image AND caption are visible at one glance: the image takes
 * the flexible space, the caption a bounded strip below it. Swipes inside
 * the deck (data-swipe-scope) turn slides, never the page; the last slide's
 * forward button continues to the next page so the flow never dead-ends.
 */
export function MobileSlideShow({ block }: { block: SlidesetBlock }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const reader = useReaderData();
  const platform = usePlatform();

  const [selected, setSelected] = useState(0);
  const [enlarged, setEnlarged] = useState<{ src: string; alt?: string }>();

  const [viewportRef, embla] = useEmblaCarousel({
    axis: "x",
    align: "start",
    containScroll: "trimSnaps",
    duration: 22,
    watchFocus: false,
  });

  const preloader = useImagePreloader(
    block.slides.flatMap((s) => s.images.map((i) => i.src)),
  );

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setSelected(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla]);

  // The next page in this platform's GLOBAL reading order (continues into
  // the next book), for the last slide's forward button.
  const nextPage = (() => {
    if (!reader?.slug) return undefined;
    return resolveGlobalPosition(
      reader.manifest,
      reader.collection,
      reader.slug,
      platform,
    )?.next;
  })();

  const isLast = selected === block.slides.length - 1;

  const goForward = () => {
    if (!isLast) {
      embla?.scrollNext();
    } else if (nextPage && params.locale) {
      void navigate({
        to: "/$locale/$",
        params: {
          locale: params.locale,
          _splat: `${nextPage.collection}/${nextPage.slug}`,
        },
      });
    }
  };

  return (
    <section
      data-swipe-scope="slides"
      role="group"
      aria-roledescription="carousel"
      aria-label={block.title}
      className="my-3 flex h-[calc(100dvh-var(--header-h)-var(--tabbar-h)-5.75rem)] min-h-80 flex-col overflow-hidden rounded-xl border border-border bg-card"
    >
      <div
        ref={viewportRef}
        className="min-h-0 flex-1 touch-pan-y overflow-hidden"
      >
        <div className="flex h-full">
          {block.slides.map((slide, i) => (
            <div
              key={i}
              inert={i !== selected}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${block.slides.length}`}
              className="flex h-full min-w-0 flex-[0_0_100%] flex-col"
            >
              {slide.images[0] && (
                <button
                  type="button"
                  className="relative min-h-0 flex-1 bg-muted/20 p-2"
                  onClick={() =>
                    setEnlarged({
                      src: slide.images[0].src,
                      alt: slide.images[0].alt,
                    })
                  }
                >
                  {!preloader.isLoaded(slide.images[0].src) && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </span>
                  )}
                  <img
                    src={slide.images[0].src}
                    alt={slide.images[0].alt ?? slide.title ?? ""}
                    className={cn(
                      "h-full w-full object-contain transition-opacity duration-200",
                      preloader.isLoaded(slide.images[0].src)
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                </button>
              )}
              <div
                className={cn(
                  "shrink-0 overflow-y-auto border-t border-border px-3 py-2",
                  slide.images[0] ? "max-h-[42%]" : "min-h-0 flex-1",
                )}
              >
                {slide.title && (
                  <h4 className="mb-1 text-sm font-semibold">{slide.title}</h4>
                )}
                <div
                  className="prose prose-invert max-w-none text-[13px] leading-snug"
                  dangerouslySetInnerHTML={{ __html: slide.html }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => embla?.scrollPrev()}
          disabled={selected === 0}
          aria-label={t("reader.previous")}
        >
          <ChevronLeft />
        </Button>
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
            {selected + 1}/{block.slides.length}
          </span>
          <div className="flex items-center gap-1 overflow-hidden">
            {block.slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${i + 1}`}
                onClick={() => embla?.scrollTo(i)}
                className={cn(
                  "size-1.5 shrink-0 rounded-full transition-all",
                  i === selected ? "w-4 bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        </div>
        <Button
          variant={isLast && nextPage ? "default" : "ghost"}
          size="sm"
          className={cn(!(isLast && nextPage) && "size-8 px-0")}
          onClick={goForward}
          disabled={isLast && !nextPage}
          aria-label={isLast ? t("reader.nextPage") : t("reader.next")}
        >
          {isLast && nextPage && (
            <span className="text-xs">{t("reader.nextPage")}</span>
          )}
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
