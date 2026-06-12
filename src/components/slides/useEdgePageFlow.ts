import { useEffect, useRef } from "react";
import type { EmblaCarouselType } from "embla-carousel";

interface EdgeFlowOptions {
  isFirst: boolean;
  isLast: boolean;
  onPrevPage?: () => void;
  onNextPage?: () => void;
}

/** Px the deck must be dragged past its edge before the page turns. */
const OVERDRAG_THRESHOLD = 56;

/**
 * Lets a slideshow flow into the surrounding book: dragging forward past the
 * last slide turns the page, dragging back past the first slide goes to the
 * previous page. Within the deck, swipes keep turning slides — so the whole
 * app stays one continuous swipe, slides included.
 */
export function useEdgePageFlow(
  embla: EmblaCarouselType | undefined,
  options: EdgeFlowOptions,
): void {
  // Listener subscribes once per embla instance; options read at gesture time.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!embla) return;
    const onPointerUp = () => {
      const engine = embla.internalEngine();
      const location = engine.location.get();
      // Embla translates run negative going forward: limit.max is the start
      // edge, limit.min the end edge. Past-edge drag = rubber-band distance.
      const overBack = location - engine.limit.max;
      const overForward = engine.limit.min - location;
      const { isFirst, isLast, onPrevPage, onNextPage } = optionsRef.current;
      if (overForward > OVERDRAG_THRESHOLD && isLast) onNextPage?.();
      else if (overBack > OVERDRAG_THRESHOLD && isFirst) onPrevPage?.();
    };
    embla.on("pointerUp", onPointerUp);
    return () => {
      embla.off("pointerUp", onPointerUp);
    };
  }, [embla]);
}
