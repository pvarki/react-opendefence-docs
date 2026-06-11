/**
 * Text-level fixups for raw Outline markdown exports.
 *
 * Ported from the old wiki's scripts/lib/markdown-processor.ts and
 * scripts/lib/text-sanitizer.ts. The regexes here encode years of
 * Outline-quirk handling — keep them byte-identical unless a quirk is
 * documented next to the change.
 *
 * NOT handled here (Track A's image-processor owns it): attachment URL
 * rewriting (`attachments/...` -> `/content/images/...`).
 */
import { normalizeLocale, type Locale } from "../../shared/content-schema";

export interface NormalizeContext {
  locale: Locale;
  collectionSlug: string;
  /** Resolves an Outline slug (incl. shortid, e.g. "first-login-qwmPnmJsrF") to a route path. */
  slugToRoute: (outlineSlug: string) => string | undefined;
}

// ---------------------------------------------------------------------------
// Emoji stripping
// ---------------------------------------------------------------------------

/**
 * Comprehensive emoji ranges, ported verbatim from the old text-sanitizer.
 * Outline authors decorate headings with emoji; they break heading ids and
 * look wrong in the TOC, so headings are stripped at sync time.
 */
const EMOJI_PATTERNS = [
  // Emoji modifiers, variation selectors, ZWJ sequences
  /[\u{1F3FB}-\u{1F3FF}]/gu,
  /[\u{FE00}-\u{FE0F}]/gu,
  /\u{200D}/gu,

  // Main emoji blocks
  /[\u{1F600}-\u{1F64F}]/gu, // Emoticons
  /[\u{1F300}-\u{1F5FF}]/gu, // Misc Symbols and Pictographs
  /[\u{1F680}-\u{1F6FF}]/gu, // Transport and Map
  /[\u{1F1E0}-\u{1F1FF}]/gu, // Flags
  /[\u{2600}-\u{26FF}]/gu, // Misc symbols
  /[\u{2700}-\u{27BF}]/gu, // Dingbats
  /[\u{1F900}-\u{1F9FF}]/gu, // Supplemental Symbols and Pictographs
  /[\u{1FA00}-\u{1FA6F}]/gu, // Chess Symbols
  /[\u{1FA70}-\u{1FAFF}]/gu, // Symbols and Pictographs Extended-A

  // Additional symbol ranges commonly used as emoji
  /[\u{231A}-\u{231B}]/gu, // Watch, Hourglass
  /[\u{23E9}-\u{23F3}]/gu, // Various symbols
  /[\u{23F8}-\u{23FA}]/gu, // Various symbols
  /[\u{25AA}-\u{25AB}]/gu, // Squares
  /[\u{25B6}]/gu, // Play button
  /[\u{25C0}]/gu, // Reverse button
  /[\u{25FB}-\u{25FE}]/gu, // Squares
  /[\u{2614}-\u{2615}]/gu, // Umbrella, Hot Beverage
  /[\u{2648}-\u{2653}]/gu, // Zodiac
  /[\u{267F}]/gu, // Wheelchair
  /[\u{2693}]/gu, // Anchor
  /[\u{26A1}]/gu, // High Voltage
  /[\u{26AA}-\u{26AB}]/gu, // Circles
  /[\u{26BD}-\u{26BE}]/gu, // Soccer, Baseball
  /[\u{26C4}-\u{26C5}]/gu, // Snowman, Sun
  /[\u{26CE}]/gu, // Ophiuchus
  /[\u{26D4}]/gu, // No Entry
  /[\u{26EA}]/gu, // Church
  /[\u{26F2}-\u{26F3}]/gu, // Fountain, Golf
  /[\u{26F5}]/gu, // Sailboat
  /[\u{26FA}]/gu, // Tent
  /[\u{26FD}]/gu, // Fuel Pump
  /[\u{2702}]/gu, // Scissors
  /[\u{2705}]/gu, // Check Mark
  /[\u{2708}-\u{270D}]/gu, // Various
  /[\u{270F}]/gu, // Pencil
  /[\u{2712}]/gu, // Black Nib
  /[\u{2714}]/gu, // Check Mark
  /[\u{2716}]/gu, // X Mark
  /[\u{271D}]/gu, // Latin Cross
  /[\u{2721}]/gu, // Star of David
  /[\u{2728}]/gu, // Sparkles
  /[\u{2733}-\u{2734}]/gu, // Eight Spoked Asterisk
  /[\u{2744}]/gu, // Snowflake
  /[\u{2747}]/gu, // Sparkle
  /[\u{274C}]/gu, // Cross Mark
  /[\u{274E}]/gu, // Cross Mark
  /[\u{2753}-\u{2755}]/gu, // Question marks
  /[\u{2757}]/gu, // Exclamation Mark
  /[\u{2763}-\u{2764}]/gu, // Heart
  /[\u{2795}-\u{2797}]/gu, // Plus, Minus, Division
  /[\u{27A1}]/gu, // Right Arrow
  /[\u{27B0}]/gu, // Curly Loop
  /[\u{27BF}]/gu, // Double Curly Loop
  /[\u{2934}-\u{2935}]/gu, // Arrows
  /[\u{2B05}-\u{2B07}]/gu, // Arrows
  /[\u{2B1B}-\u{2B1C}]/gu, // Squares
  /[\u{2B50}]/gu, // Star
  /[\u{2B55}]/gu, // Circle
  /[\u{3030}]/gu, // Wavy Dash
  /[\u{303D}]/gu, // Part Alternation Mark
  /[\u{3297}]/gu, // Circled Ideograph Congratulation
  /[\u{3299}]/gu, // Circled Ideograph Secret
];

/**
 * Remove emojis from text. Also collapses runs of whitespace (the removal
 * leaves double spaces behind) and trims — same as the old sanitizer.
 */
export function stripEmojis(text: string): string {
  let result = text;
  for (const pattern of EMOJI_PATTERNS) {
    result = result.replace(pattern, "");
  }
  return result.replace(/\s+/g, " ").trim();
}

/** Strip emojis from markdown headings only (H1-H6); other lines untouched. */
function stripEmojisFromHeadings(markdown: string): string {
  return markdown.replace(/^(#{1,6})\s+(.+)$/gm, (_match, hashes, text) => {
    return `${hashes} ${stripEmojis(text)}`;
  });
}

// ---------------------------------------------------------------------------
// Outline export fixups (ported byte-identical from markdown-processor.ts)
// ---------------------------------------------------------------------------

/** Convert raw `<url>` autolinks to `[url](url)` (MDX-era habit kept for mdast uniformity). */
function replaceRawLinks(markdown: string): string {
  const urlLinkPattern = /<((http|https):\/\/[^>]+)>/g;
  return markdown.replace(urlLinkPattern, (_match, url) => `[${url}](${url})`);
}

/** Outline sometimes exports empty image tags; drop them. */
function removeEmptyImages(markdown: string): string {
  return markdown.replace(/!\[\]\(\s*\)/g, "");
}

/**
 * Unescape characters Outline escapes in its markdown export. The final rule
 * also unwraps `__` around image paths (an Outline export artifact that
 * turned paths into bold markers).
 */
function unescapeMarkdown(markdown: string): string {
  return (
    markdown
      .replace(/\\!/g, "!")
      .replace(/\\\[/g, "[")
      .replace(/\\]/g, "]")
      .replace(/\\\*/g, "*")
      .replace(/\\_/g, "_")
      .replace(/\\:/g, ":")
      .replace(/\\-/g, "-")
      .replace(/\\`/g, "`")
      // Remove double underscores around image paths
      .replace(/(!\[[^\]]*\]\()__([^)]+)__(\))/g, "$1$2$3")
      // Outline exports intentionally blank lines as a lone backslash, which
      // would otherwise render as a literal "\" paragraph.
      .replace(/^\\\s*$/gm, "")
  );
}

/** Collapse 3+ blank lines, strip trailing line whitespace, single final newline. */
function fixMarkdownIssues(markdown: string): string {
  return markdown
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n*$/, "\n");
}

/** Remove a leading YAML frontmatter block if present (defensive; raw API exports usually have none). */
function removeExistingFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n*/, "");
}

/**
 * Rewrite Outline internal links to app routes.
 * Matches `[text](/doc/slug-shortid)` and
 * `[text](https://anything.getoutline.com/doc/slug-shortid)`, with optional
 * `#anchor`. Unresolvable links are left unchanged (the doc may be in a
 * collection we don't sync).
 */
function replaceInternalLinks(
  markdown: string,
  slugToRoute: (outlineSlug: string) => string | undefined,
): string {
  const internalLinkPattern =
    /\[([^\]]+)\]\((?:https?:\/\/[^/]+)?\/doc\/([^)#]+)(#[^)]+)?\)/g;

  return markdown.replace(
    internalLinkPattern,
    (match, linkText, docKey, anchor) => {
      const route = slugToRoute(docKey);
      if (!route) return match;
      return `[${linkText}](${route}${anchor || ""})`;
    },
  );
}

/**
 * Normalize raw Outline markdown. Order matters and mirrors the old
 * MARKDOWN_PROCESSORS pipeline: unescaping must run before link rewriting,
 * emoji stripping before heading-id generation downstream.
 */
export function normalizeOutlineMarkdown(
  markdown: string,
  ctx: NormalizeContext,
): string {
  let result = removeExistingFrontmatter(markdown);
  result = replaceRawLinks(result);
  result = removeEmptyImages(result);
  result = unescapeMarkdown(result);
  result = stripEmojisFromHeadings(result);
  result = fixMarkdownIssues(result);
  result = replaceInternalLinks(result, ctx.slugToRoute);
  return result;
}

// ---------------------------------------------------------------------------
// Translation links
// ---------------------------------------------------------------------------

/**
 * Extract the "* Translations:" bullet block authors maintain at the top of
 * each document. Returns bare Outline slugs (last path segment, shortid
 * included) keyed by locale.
 *
 * Block regex ported from the old scripts/extract-translations.ts. The link
 * regex additionally tolerates absolute Outline URLs
 * (`https://x.getoutline.com/doc/...`) because we now run on raw exports,
 * not on already-rewritten MDX. Locale codes go through normalizeLocale so
 * the legacy "se" code maps to "sv".
 *
 * Call AFTER normalizeOutlineMarkdown — raw exports may escape the `*`
 * bullets, which this regex does not tolerate.
 */
export function extractTranslationLinks(
  markdown: string,
): Partial<Record<Locale, string>> {
  // The block regex requires every bullet line to end with \n.
  const input = markdown.endsWith("\n") ? markdown : `${markdown}\n`;
  const translationRegex = /\* Translations:\s*\n((?:\s*\*\s+\w+:.*\n)+)/;
  const match = input.match(translationRegex);
  if (!match) return {};

  const translations: Partial<Record<Locale, string>> = {};
  const linkRegex =
    /\*\s+(\w+):\s+\[.*?\]\((?:https?:\/\/[^/\s)]+)?(\/\S+?)\)/g;

  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRegex.exec(match[1])) !== null) {
    const locale = normalizeLocale(linkMatch[1]);
    if (!locale) continue;
    const slugMatch = linkMatch[2].match(/\/([^/]+)$/);
    if (slugMatch) translations[locale] = slugMatch[1];
  }

  return translations;
}
