import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

interface FitTextOptions {
  /**
   * Smallest font size (px). The floor that still guarantees a fit for the
   * most verbose caption in the corpus; below it the box scrolls as a last
   * resort so the deck layout can never break.
   */
  min?: number;
  /** Largest font size (px) — how big short captions are allowed to grow. */
  max?: number;
}

/**
 * Picks the largest font size in [min, max] at which `contentRef` still fits
 * inside `boxRef` — in both height and width. Re-fits when the box resizes
 * (window/dvh changes), once web fonts load, and whenever min/max change.
 *
 * The box must own a *definite* height (independent of its text), so the
 * result is stable: scaling the content never changes the box, so there is no
 * measure → grow → measure feedback loop.
 */
export function useFitText<
  B extends HTMLElement = HTMLDivElement,
  C extends HTMLElement = HTMLDivElement,
>({ min = 13, max = 24 }: FitTextOptions = {}) {
  const boxRef = useRef<B>(null);
  const contentRef = useRef<C>(null);
  const [fontSize, setFontSize] = useState(max);

  const fit = useCallback(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return;
    const maxH = box.clientHeight;
    const maxW = box.clientWidth;
    if (maxH <= 0 || maxW <= 0) return;

    const fits = (px: number) => {
      content.style.fontSize = `${px}px`;
      return content.scrollHeight <= maxH && content.scrollWidth <= maxW;
    };

    let best = min;
    if (fits(max)) {
      best = max;
    } else {
      // Binary search the largest size that fits — ~7 steps is sub-pixel.
      let lo = min;
      let hi = max;
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) {
          best = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }
    }
    best = Math.round(best * 100) / 100;
    content.style.fontSize = `${best}px`;
    setFontSize(best);
  }, [min, max]);

  useLayoutEffect(() => {
    fit();
  }, [fit]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(box);
    let cancelled = false;
    // Web fonts shift text metrics — re-fit once they are ready.
    void document.fonts?.ready.then(() => {
      if (!cancelled) fit();
    });
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [fit]);

  return { boxRef, contentRef, fontSize };
}
