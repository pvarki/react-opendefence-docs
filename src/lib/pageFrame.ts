export const PAGE_FRAME = "mx-auto w-full max-w-5xl px-4 md:px-8";

/**
 * The scroller of a shelf-level page. pan-y: a sideways touch is never the
 * browser's to pan — otherwise it cancels the pointer after a few px and the
 * shelf swipe (useShelfSwipe) never sees the swipe end. It has to sit on the
 * scroller itself: a scroll container resets what its ancestors restrict.
 */
export const SHELF_SCROLL =
  "flex h-full flex-col overflow-y-auto touch-pan-y touch-pinch-zoom";
