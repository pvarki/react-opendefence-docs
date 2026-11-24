import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { usePane, type SlideParam } from "@/components/reader/paneContext";
import { useEdgePageFlow } from "@/components/slides/useEdgePageFlow";
import { onWheelSwipe } from "@/lib/wheelSwipe";

/** Quiet time after the last slide change before `?slide=` is written. */
const URL_WRITE_DELAY_MS = 250;

/**
 * A step made from the keyboard takes the focus along: the deck it lands on
 * focuses the same button, so holding one key walks the whole book.
 */
let focusOnArrival: { page: string; dir: 1 | -1 } | undefined;

/** The slide a deck opens on: the URL's `?slide=`, else the first. */
function entryIndex(slide: SlideParam | undefined, count: number): number {
  if (slide === "last") return count - 1;
  // A hand-edited ?slide= reaches here as it was typed.
  return typeof slide === "number" && Number.isInteger(slide)
    ? Math.min(Math.max(slide, 1), count) - 1
    : 0;
}

/**
 * What both slideshow form factors share: the carousel, the selected slide,
 * and the flow into the surrounding book — stepping (or dragging) past the
 * last slide continues on the next page's first slide, stepping back past the
 * first one continues on the previous page's last slide.
 */
export function useDeck(
  count: number,
  { bindSlideParam, duration }: { bindSlideParam: boolean; duration: number },
) {
  const pane = usePane();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const isCurrent = pane?.isCurrent ?? true;
  const slide = bindSlideParam ? pane?.slide : undefined;

  const [selected, setSelected] = useState(() => entryIndex(slide, count));
  // Built once: options that change by value make Embla rebuild its engine,
  // which cuts whatever animation is running.
  const [options] = useState(() => ({
    axis: "x" as const,
    align: "start" as const,
    containScroll: "trimSnaps" as const,
    skipSnaps: false,
    duration,
    startIndex: selected,
    watchFocus: false,
  }));
  const [viewportRef, embla] = useEmblaCarousel(options);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setSelected(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla]);

  // Arriving on the page opens the deck where the URL says. Not a live
  // binding: once here, the deck leads and the URL follows (below).
  const slideRef = useRef(slide);
  useEffect(() => {
    slideRef.current = slide;
  });
  useEffect(() => {
    if (embla && isCurrent) {
      embla.scrollTo(entryIndex(slideRef.current, count), true);
    }
  }, [embla, isCurrent, count]);

  // A deck left behind rewinds once it is out of sight, so swiping back
  // reveals it on the slide it is going to open on.
  useEffect(() => {
    const section = sectionRef.current;
    if (!embla || !section || isCurrent) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) embla.scrollTo(0, true);
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, [embla, isCurrent]);

  // The URL follows the deck (deep links, Back), once the reader pauses:
  // a router navigation per slide of a quick flip-through is wasted work.
  useEffect(() => {
    if (!bindSlideParam || !isCurrent) return;
    const step = selected + 1;
    if (slide === step || (slide === undefined && selected === 0)) return;
    const timer = setTimeout(() => {
      void navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({ ...prev, slide: step }),
        replace: true,
      });
    }, URL_WRITE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [bindSlideParam, isCurrent, selected, slide, navigate]);

  const stepPage = useCallback(
    (dir: 1 | -1, cut: boolean) => {
      const dest = dir === 1 ? pane?.position.next : pane?.position.prev;
      if (!pane || !dest) return;
      if (sectionRef.current?.contains(document.activeElement)) {
        focusOnArrival = { page: `${dest.collection}/${dest.slug}`, dir };
      }
      pane.step(dir, cut);
    },
    [pane],
  );

  const page = pane?.position.page;
  const ownPage = page && `${page.collection}/${page.slug}`;
  useEffect(() => {
    if (!isCurrent || !focusOnArrival) return;
    if (focusOnArrival.page === ownPage) {
      sectionRef.current
        ?.querySelector<HTMLElement>(`[data-step="${focusOnArrival.dir}"]`)
        ?.focus({ preventScroll: true });
    }
    focusOnArrival = undefined;
  }, [isCurrent, ownPage]);

  const isFirst = selected === 0;
  const isLast = selected === count - 1;

  // A long deck has more dots than its strip can show: keep the current one
  // in the middle of it.
  useEffect(() => {
    const strip = dotsRef.current;
    const dot = strip?.children[selected];
    if (strip && dot instanceof HTMLElement) {
      strip.scrollLeft =
        dot.offsetLeft - (strip.clientWidth - dot.offsetWidth) / 2;
    }
  }, [selected]);

  // Dragging past the deck's edges continues through the book too — as a
  // page turn; the buttons below cut (see PageSwiper).
  useEdgePageFlow(embla, {
    isFirst,
    isLast,
    onPrevPage: () => stepPage(-1, false),
    onNextPage: () => stepPage(1, false),
  });

  // A trackpad swipe over the deck steps a slide, and past either end turns
  // the page; it stays with the deck instead of turning the page behind it.
  useEffect(() => {
    const section = sectionRef.current;
    if (!embla || !section) return;
    return onWheelSwipe(section, (dir) => {
      if (dir === 1 ? embla.canScrollNext() : embla.canScrollPrev()) {
        embla.scrollTo(embla.selectedScrollSnap() + dir);
      } else {
        stepPage(dir, false);
      }
    });
  }, [embla, stepPage]);

  return {
    sectionRef,
    viewportRef,
    dotsRef,
    selected,
    isFirst,
    isLast,
    hasPrevPage: !!pane?.position.prev,
    hasNextPage: !!pane?.position.next,
    goTo: (index: number) => embla?.scrollTo(index),
    goPrev: () => (isFirst ? stepPage(-1, true) : embla?.scrollPrev()),
    goNext: () => (isLast ? stepPage(1, true) : embla?.scrollNext()),
    /** Leave the deck mid-way for the next page. */
    skip: () => stepPage(1, true),
  };
}
