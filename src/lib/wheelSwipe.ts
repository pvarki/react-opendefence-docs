/** Sideways travel that makes a swipe. */
const SWIPE_PX = 60;
/** A wheel stream that pauses this long is over, inertia included. */
const IDLE_MS = 160;

/** Something between the pointer and `root` that scrolls sideways itself. */
function scrollsSideways(target: EventTarget | null, root: HTMLElement) {
  for (
    let el = target instanceof Element ? target : null;
    el && el !== root;
    el = el.parentElement
  ) {
    if (
      el.scrollWidth > el.clientWidth &&
      /auto|scroll/.test(getComputedStyle(el).overflowX)
    ) {
      return true;
    }
  }
  return false;
}

// One pointer, one wheel stream: its state is shared by every swipe area, so
// the stream that turned a page cannot also step the slideset that page
// brought under the pointer. Time is the events' own (when the fingers moved),
// so a busy main thread cannot make a stream look like it paused.
let travel = 0;
let spent = false;
let lastAt = 0;

/**
 * Calls `onSwipe` once for a sideways trackpad swipe over `el`: once a swipe
 * has fired, the rest of that wheel stream — the fingers' remaining travel
 * and the inertia after them — is ignored until the stream pauses. Travel is
 * judged by distance, so a short flick counts as much as a long drag.
 * Vertical scrolling never adds up to a swipe, wide code blocks and tables
 * keep their own sideways scrolling, and a swipe handled here does not reach
 * an enclosing swipe area. Returns the unsubscribe.
 */
export function onWheelSwipe(
  el: HTMLElement,
  onSwipe: (dir: 1 | -1) => void,
): () => void {
  const onWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) {
      travel = 0; // sideways drift in a vertical scroll never accumulates
      return;
    }
    if (scrollsSideways(e.target, el)) return;
    e.stopPropagation();
    if (e.timeStamp - lastAt > IDLE_MS) {
      travel = 0;
      spent = false;
    }
    lastAt = e.timeStamp;
    if (spent) return;
    travel += e.deltaX;
    if (Math.abs(travel) < SWIPE_PX) return;
    spent = true;
    onSwipe(travel > 0 ? 1 : -1);
  };

  el.addEventListener("wheel", onWheel, { passive: true });
  return () => el.removeEventListener("wheel", onWheel);
}
