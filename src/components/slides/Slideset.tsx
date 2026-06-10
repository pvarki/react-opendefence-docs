import { useIsMobile } from "@/hooks/use-mobile";
import type { SlidesetBlock } from "@shared/content-schema";
import { SlideDeck } from "@/components/slides/SlideDeck";
import { StepList } from "@/components/slides/StepList";

interface SlidesetProps {
  block: SlidesetBlock;
  bindSlideParam?: boolean;
}

/**
 * Step-by-step guide block, the historically hardest UI piece — solved by
 * never sharing a gesture code path: desktop gets an Embla slide deck (its
 * own data-swipe-scope), mobile gets a plain vertical step list with zero
 * gesture code on the platform where nesting used to break.
 */
export function Slideset({ block, bindSlideParam }: SlidesetProps) {
  const isMobile = useIsMobile();

  return isMobile ? (
    <StepList block={block} />
  ) : (
    <SlideDeck block={block} bindSlideParam={bindSlideParam} />
  );
}
