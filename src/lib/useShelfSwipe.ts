import { useEffect, useRef } from "react";
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { stripBase } from "@/lib/base";
import { EDGE_DEAD_ZONE_PX } from "@/components/reader/emblaPageOptions";
import { SHELF_STOPS, shelfStopIndex } from "@/lib/shelfNav";

/** Pointer drag must travel this far horizontally to count as a swipe. */
const SWIPE_DISTANCE_PX = 60;
/** Trackpad horizontal travel that commits one stop. */
const WHEEL_DISTANCE_PX = 80;
/** A swipe must be this many× more horizontal than vertical (vs. scroll). */
const HORIZONTAL_RATIO = 1.4;
/** Quiet window after a wheel commit, so one flick turns one stop. */
const WHEEL_COOLDOWN_MS = 600;
/** A pause this long resets accumulated wheel travel. */
const WHEEL_IDLE_MS = 200;

/**
 * Directional slide via the browser View Transitions API is only requested
 * where the matching `:active-view-transition-type()` selector exists —
 * elsewhere we navigate plainly (instant, no animation), never risking a
 * broken page swap on older engines.
 */
const SUPPORTS_SLIDE =
  typeof document !== "undefined" &&
  "startViewTransition" in document &&
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("selector(:active-view-transition-type(x))");

const EXCLUDE_SELECTOR =
  "[data-swipe-scope],input,textarea,select,[contenteditable=true]";

/**
 * Horizontal swipe / drag / wheel / arrow-key navigation between the
 * bookshelf-level landing pages (see {@link SHELF_STOPS}). A no-op on every
 * other route, so the in-book reader's own swipe is untouched. Mount once,
 * high in the locale layout, so listeners survive landing→landing turns.
 */
export function useShelfSwipe(): void {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const pathname = useRouterState({
    select: (s) => stripBase(s.location.pathname),
  });

  // Listeners attach once and read the live route from refs at gesture time.
  const locale = params.locale;
  const stopIndex = locale ? shelfStopIndex(pathname, locale) : -1;
  const indexRef = useRef(-1);
  const localeRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    indexRef.current = stopIndex;
    localeRef.current = locale;
  });

  useEffect(() => {
    const go = (dir: 1 | -1) => {
      const i = indexRef.current;
      const loc = localeRef.current;
      if (i < 0 || !loc) return;
      const target = i + dir;
      if (target < 0 || target >= SHELF_STOPS.length) return;
      const viewTransition = SUPPORTS_SLIDE
        ? { types: [dir === 1 ? "shelf-forward" : "shelf-back"] }
        : undefined;
      switch (SHELF_STOPS[target].id) {
        case "home":
          void navigate({
            to: "/$locale",
            params: { locale: loc },
            viewTransition,
          });
          break;
        case "deploy-app":
          void navigate({
            to: "/$locale/$",
            params: { locale: loc, _splat: "deploy-app" },
            viewTransition,
          });
          break;
        case "guides":
          void navigate({
            to: "/$locale/guides",
            params: { locale: loc },
            viewTransition,
          });
          break;
        case "advanced":
          void navigate({
            to: "/$locale/advanced",
            params: { locale: loc },
            viewTransition,
          });
          break;
        case "dev":
          void navigate({
            to: "/$locale/dev",
            params: { locale: loc },
            viewTransition,
          });
          break;
      }
    };

    // Keyboard: ← previous stop, → next stop.
    const onKeyDown = (e: KeyboardEvent) => {
      if (indexRef.current < 0) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target as Element | null;
      if (target?.closest(EXCLUDE_SELECTOR)) return;
      e.preventDefault();
      go(e.key === "ArrowRight" ? 1 : -1);
    };

    // Pointer: one path for touch, mouse and pen. We never preventDefault, so
    // vertical scrolling stays native; the swipe is judged only on release.
    // Only the first pointer is tracked; a second one landing (pinch-zoom,
    // two-finger gestures) poisons the gesture so it can't commit a turn.
    let startX = 0;
    let startY = 0;
    let activePointerId: number | null = null;
    let multiTouch = false;
    const onPointerDown = (e: PointerEvent) => {
      if (activePointerId !== null) {
        multiTouch = true;
        return;
      }
      if (indexRef.current < 0) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target as Element | null;
      if (target?.closest(EXCLUDE_SELECTOR)) return;
      // Leave the OS edge-swipe (iOS back) alone.
      if (
        e.clientX < EDGE_DEAD_ZONE_PX ||
        e.clientX > window.innerWidth - EDGE_DEAD_ZONE_PX
      ) {
        return;
      }
      activePointerId = e.pointerId;
      multiTouch = false;
      startX = e.clientX;
      startY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (activePointerId === null || e.pointerId !== activePointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const wasMultiTouch = multiTouch;
      activePointerId = null;
      multiTouch = false;
      if (wasMultiTouch || indexRef.current < 0) return;
      if (Math.abs(dx) < SWIPE_DISTANCE_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return; // a scroll
      // A drag that selected text is text selection, not a page turn.
      const selection = window.getSelection?.();
      if (selection && !selection.isCollapsed && selection.toString().length) {
        return;
      }
      go(dx < 0 ? 1 : -1);
    };
    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerId === activePointerId) {
        activePointerId = null;
        multiTouch = false;
      }
    };

    // Wheel: trackpad horizontal flicks, debounced to one stop per gesture.
    let wheelAccum = 0;
    let wheelIdle: ReturnType<typeof setTimeout> | undefined;
    let wheelCooldown = false;
    const onWheel = (e: WheelEvent) => {
      if (indexRef.current < 0 || wheelCooldown) return;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // vertical scroll
      const target = e.target as Element | null;
      if (target?.closest(EXCLUDE_SELECTOR)) return;
      wheelAccum += e.deltaX;
      clearTimeout(wheelIdle);
      wheelIdle = setTimeout(() => {
        wheelAccum = 0;
      }, WHEEL_IDLE_MS);
      if (Math.abs(wheelAccum) < WHEEL_DISTANCE_PX) return;
      const dir = wheelAccum > 0 ? 1 : -1;
      wheelAccum = 0;
      wheelCooldown = true;
      setTimeout(() => {
        wheelCooldown = false;
      }, WHEEL_COOLDOWN_MS);
      go(dir);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("wheel", onWheel);
      clearTimeout(wheelIdle);
    };
  }, [navigate]);
}
