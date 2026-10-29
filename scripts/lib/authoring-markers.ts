/**
 * Plain-text markers authors type into Outline document bodies. Each marker
 * has exactly one official form: English in every locale, matched case-
 * insensitively.
 */

/** The page is a draft (see isUnderDevelopment in block-emitter). */
export const UNDER_DEVELOPMENT_MARKER = "(This tab is under development)";

/** Regex source matching `marker` literally; use with the `i` flag. */
export function markerSource(marker: string): string {
  return marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
