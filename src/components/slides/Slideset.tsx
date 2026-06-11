import { useIsMobile } from "@/hooks/use-mobile";
import type { SlidesetBlock } from "@shared/content-schema";
import { SlideDeck } from "@/components/slides/SlideDeck";
import { MobileSlideShow } from "@/components/slides/MobileSlideShow";

interface SlidesetProps {
  block: SlidesetBlock;
  bindSlideParam?: boolean;
}

/**
 * Step-by-step guide block. Both form factors are swipable slideshows that
 * own their gestures (data-swipe-scope): desktop shows image-left/text-right
 * slides, mobile maximizes the screen so image and caption are both visible
 * at one glance.
 */
export function Slideset({ block, bindSlideParam }: SlidesetProps) {
  const isMobile = useIsMobile();

  return isMobile ? (
    <MobileSlideShow block={block} />
  ) : (
    <SlideDeck block={block} bindSlideParam={bindSlideParam} />
  );
}
