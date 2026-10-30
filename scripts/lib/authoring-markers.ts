/**
 * Plain-text markers authors type into Outline document bodies. Each marker
 * has exactly one official form: English in every locale, matched case-
 * insensitively. Look-alikes (translations, other wordings) are not
 * recognised; findMarkerVariants reports them so authors can fix them.
 */

/** The page is a draft (see isUnderDevelopment in block-emitter). */
export const UNDER_DEVELOPMENT_MARKER = "(This tab is under development)";

/** Regex source matching `marker` literally; use with the `i` flag. */
export function markerSource(marker: string): string {
  return marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The page is not meant to be shown on the site. */
export const HIDE_MARKER = "(This tab should not be shown)";

/** Lower-case words separated by single spaces, punctuation dropped. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Keywords match whole normalized words: the text is padded with a space on
// each side. A look-alike matches every keyword pattern of its marker.
const MARKER_LOOKALIKES: { official: string; keywords: RegExp[] }[] = [
  {
    official: UNDER_DEVELOPMENT_MARKER,
    keywords: [
      / (?:under development|under construction|work in progress|työn alla|kehitys kesken|kehitteillä|under utveckling|under arbete) /,
    ],
  },
  {
    official: HIDE_MARKER,
    // A page word and a "not shown" phrase: "(visa inte lösenordet)" is fine.
    keywords: [
      / (?:tab|page|välilehti|välilehteä|sivu|sivua|flik|fliken|sida|sidan) /,
      / (?:not be shown|(?:do not|don t) show|ei pitäisi näyttää|ei saa näyttää|ei näytetä|älä näytä|ska inte visas|bör inte visas|visa inte) /,
    ],
  },
];

export interface MarkerVariant {
  /** The text as written, e.g. "(Tätä välilehteä ei pitäisi näyttää)". */
  found: string;
  /** The official marker it resembles. */
  official: string;
}

/**
 * Marker look-alikes in `text` that are not the official form: near-misses
 * such as a stray period or space, and parentheticals with marker keywords.
 */
export function findMarkerVariants(text: string): MarkerVariant[] {
  const variants: MarkerVariant[] = [];
  for (const [found] of text.matchAll(/\([^()\n]{0,60}\)/g)) {
    const words = normalize(found);
    const lookalike = MARKER_LOOKALIKES.find(
      ({ official, keywords }) =>
        words === normalize(official) ||
        keywords.every((keyword) => keyword.test(` ${words} `)),
    );
    if (lookalike && found.toLowerCase() !== lookalike.official.toLowerCase()) {
      variants.push({ found, official: lookalike.official });
    }
  }
  return variants;
}
