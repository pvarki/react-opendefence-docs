import type { EmblaOptionsType } from "embla-carousel";

/**
 * Gestures starting within this many px of the screen edges are left to the
 * OS: iOS Safari/standalone edge-swipe back cannot be disabled, so we never
 * compete with it. (Navigation still works there — every page turn is a
 * history entry, so the OS gesture lands on the previous page.)
 */
export const EDGE_DEAD_ZONE_PX = 32;

export interface PageDragGuards {
  /** True while a settle->navigate->reInit commit is in flight. */
  navLocked: () => boolean;
}

export function pageSwiperOptions(
  startIndex: number,
  guards: PageDragGuards,
): EmblaOptionsType {
  return {
    axis: "x",
    align: "start",
    containScroll: "trimSnaps",
    skipSnaps: false,
    dragFree: false,
    duration: 25,
    startIndex,
    watchFocus: false,
    watchSlides: false,
    watchDrag: (_api, evt) => {
      if (guards.navLocked()) return false;
      const target = evt.target as Element | null;
      if (!target) return false;
      // Slidesets / lightboxes own their gestures; form fields keep selection.
      if (target.closest("[data-swipe-scope]")) return false;
      if (target.closest("input,textarea,select,[contenteditable=true]")) {
        return false;
      }
      const x =
        "touches" in evt
          ? evt.touches[0]?.clientX
          : (evt as PointerEvent).clientX;
      if (x === undefined) return false;
      if (x < EDGE_DEAD_ZONE_PX || x > window.innerWidth - EDGE_DEAD_ZONE_PX) {
        return false;
      }
      return true;
    },
  };
}
