/**
 * Intermediate slideset shapes shared by the legacy (code-fence + Pictures
 * list) and canonical (META: slides) parsers. The block emitter turns these
 * into `SlidesetBlock`s by rendering `bodyMarkdown` to sanitized HTML and
 * joining `imageRefs` with measured image dimensions.
 */
import type { SlideLayout } from "../../../shared/content-schema";

export interface RawSlide {
  title?: string;
  layout: SlideLayout;
  /** Slide body as markdown (not yet rendered/sanitized). */
  bodyMarkdown: string;
  /** Resolved image srcs (already rewritten to /content/images/... paths). */
  imageRefs: string[];
}

export interface RawSlideset {
  source: "canonical" | "legacy";
  title?: string;
  slides: RawSlide[];
}
