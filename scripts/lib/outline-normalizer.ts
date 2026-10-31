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
  /** Slugs and ids of hidden pages: links to them become plain text. */
  hiddenDocKeys?: ReadonlySet<string>;
  /**
   * Told about each body link that pointed to a hidden page. Translations
   * list links are not reported: the list is not shown on the page.
   */
  onHiddenLink?: (linkText: string, docKey: string) => void;
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
      // would otherwise render as a literal "\" paragraph. Inside list items
      // the line is indented, so leading whitespace is allowed.
      .replace(/^[ \t]*\\\s*$/gm, "")
  );
}

/** Fenced code blocks (captured, so split() keeps them) and inline code spans. */
const CODE_FENCE_RE = /(^[ \t]*```[\s\S]*?^[ \t]*```[ \t]*$)/m;
const INLINE_CODE_RE = /`[^`\n]+`/g;

/** Literal `\n` runs and the spaces after them; an escaped `\\n` is text. */
const SOFT_BREAK_RE = /(?<!\\)(?:\\n)+[ \t]*/;

/**
 * Escape a heading, quote, list, fence or rule marker at the start of text
 * that followed a soft break. Outline escapes these only at a real line
 * start, and the text now begins a line.
 */
function escapeBlockStart(text: string): string {
  return text
    .replace(/^(#{1,6}(?=[ \t]|$)|>|[-+*](?=[ \t]|$)|```|~~~)/, "\\$1")
    .replace(/^(\d{1,9})([.)])(?=[ \t]|$)/, "$1\\$2")
    .replace(/^([-=*_])(?=[-=*_ \t]*$)/, "\\$1");
}

/**
 * Outline exports a soft line break (Shift+Enter) as a literal `\n` unless
 * the export runs in CommonMark mode (HardBreak.toMarkdown in Outline's
 * editor; tables get `<br>` instead). Turn them into markdown hard breaks
 * outside code (a space in headings), and drop one at a line end, where a
 * newline follows anyway.
 */
function convertLiteralLineBreaks(markdown: string): string {
  const convertLine = (line: string): string => {
    // Mask inline code so a `\n` inside it survives (NUL never occurs in text).
    const spans: string[] = [];
    const masked = line.replace(
      INLINE_CODE_RE,
      (span) => `\0${spans.push(span) - 1}\0`,
    );
    const [first, ...rest] = masked.split(SOFT_BREAK_RE);
    // A heading can't hold a hard break (a trailing "\" shows as text).
    const heading = /^[ \t]{0,3}#{1,6}[ \t]/.test(first);
    let out = first;
    for (const part of rest) {
      if (part === "") continue;
      if (heading) out += ` ${part}`;
      else if (out.trim() === "") out += escapeBlockStart(part);
      else out += `\\\n${escapeBlockStart(part)}`;
    }
    return out.replace(/\0(\d+)\0/g, (_, i: string) => spans[Number(i)]);
  };
  return markdown
    .split(CODE_FENCE_RE)
    .map((segment, i) =>
      i % 2 === 1 ? segment : segment.split("\n").map(convertLine).join("\n"),
    )
    .join("");
}

/** Two or more spaces at a line end: a CommonMark hard break. */
const TRAILING_SPACE_BREAK_RE = / {2,}$/;

/**
 * A line that CommonMark reads as a new block, not as more text of the
 * line above: blank, a list item, heading, fence, rule or table row. The
 * optional prefix is a list item's indent or quote markers. (Two spaces
 * kept before a new block are harmless: CommonMark ignores them.)
 */
const NEW_BLOCK_LINE_RE =
  /^[ \t]*(?:>[ \t]?)*[ \t]*(?:$|[-+*][ \t]|\d{1,9}[.)](?:[ \t]|$)|#{1,6}(?:[ \t]|$)|```|~~~|\||[-*_](?:[ \t]*[-*_]){2,}[ \t]*$)/;

const HEADING_LINE_RE = /^[ \t]{0,3}#{1,6}[ \t]/;

/**
 * Whether `line` ends in a hard break that CommonMark keeps: two or more
 * trailing spaces, and the next line goes on with the same text. Outline's
 * API export runs in CommonMark mode, which writes a soft line break
 * (Shift+Enter) this way (HardBreak.toMarkdown in Outline's editor).
 */
function endsInHardBreak(line: string, next: string | undefined): boolean {
  return (
    next !== undefined &&
    TRAILING_SPACE_BREAK_RE.test(line) &&
    line.trim() !== "" &&
    !line.trimStart().startsWith("|") &&
    !NEW_BLOCK_LINE_RE.test(next)
  );
}

/** Apply `convert` to the lines outside fenced code blocks. */
function mapLinesOutsideCode(
  markdown: string,
  convert: (lines: string[]) => string[],
  convertCode: (fence: string) => string = (fence) => fence,
): string {
  return markdown
    .split(CODE_FENCE_RE)
    .map((segment, i) =>
      i % 2 === 1
        ? convertCode(segment)
        : convert(segment.split("\n")).join("\n"),
    )
    .join("");
}

/**
 * A heading can't hold a hard break, so join the line after a trailing-space
 * break onto the heading with a space, as convertLiteralLineBreaks does.
 * Runs before stripEmojisFromHeadings, which trims the trailing spaces.
 */
function joinHeadingBreaks(markdown: string): string {
  return mapLinesOutsideCode(markdown, (lines) => {
    const out: string[] = [];
    for (const line of lines) {
      const prev = out[out.length - 1];
      if (
        prev !== undefined &&
        HEADING_LINE_RE.test(prev) &&
        endsInHardBreak(prev, line)
      ) {
        // Keep this line's own trailing spaces: it may break again.
        out[out.length - 1] =
          `${prev.replace(TRAILING_SPACE_BREAK_RE, "")} ${line.trimStart()}`;
      } else {
        out.push(line);
      }
    }
    return out;
  });
}

/**
 * Strip trailing line whitespace, except a hard break outside code, which
 * keeps two spaces: stripping it would turn the break into a space.
 */
function stripTrailingWhitespace(markdown: string): string {
  return mapLinesOutsideCode(
    markdown,
    (lines) =>
      lines.map((line, i) =>
        endsInHardBreak(line, lines[i + 1])
          ? line.replace(TRAILING_SPACE_BREAK_RE, "  ")
          : line.replace(/[ \t]+$/, ""),
      ),
    (fence) => fence.replace(/[ \t]+$/gm, ""),
  );
}

/** Collapse 3+ blank lines, strip trailing line whitespace, single final newline. */
function fixMarkdownIssues(markdown: string): string {
  return stripTrailingWhitespace(markdown.replace(/\n{3,}/g, "\n\n")).replace(
    /\n*$/,
    "\n",
  );
}

/** Remove a leading YAML frontmatter block if present (defensive; raw API exports usually have none). */
function removeExistingFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n*/, "");
}

/** The "* Translations:" bullet list; every line must end with \n. */
const TRANSLATIONS_LIST = /\* Translations:\s*\n((?:\s*\*\s+\w+:.*\n)+)/;

/** `[text](/doc/<key>#anchor)`, with or without the Outline host. */
const INTERNAL_LINK =
  /\[([^\]]+)\]\((?:https?:\/\/[^/]+)?\/doc\/([^)#]+)(#[^)]+)?\)/g;

/** Keys (slugs or ids) of the Outline docs that `markdown` links to. */
export function linkedDocKeys(markdown: string): Set<string> {
  return new Set(Array.from(markdown.matchAll(INTERNAL_LINK), (m) => m[2]));
}

/**
 * Rewrite Outline internal links to app routes.
 * Matches `[text](/doc/slug-shortid)` and
 * `[text](https://anything.getoutline.com/doc/slug-shortid)`, with optional
 * `#anchor`. Unresolvable links are left unchanged (the doc may be in a
 * collection we don't sync). A link to a hidden page keeps only its text.
 */
function replaceInternalLinks(markdown: string, ctx: NormalizeContext): string {
  const list = `${markdown}\n`.match(TRANSLATIONS_LIST);
  const inList = (offset: number) =>
    list?.index !== undefined &&
    offset >= list.index &&
    offset < list.index + list[0].length;

  return markdown.replace(
    INTERNAL_LINK,
    (match, linkText, docKey, anchor, offset: number) => {
      if (ctx.hiddenDocKeys?.has(docKey)) {
        if (!inList(offset)) ctx.onHiddenLink?.(linkText, docKey);
        return linkText;
      }
      const route = ctx.slugToRoute(docKey);
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
  result = convertLiteralLineBreaks(result);
  result = joinHeadingBreaks(result);
  result = stripEmojisFromHeadings(result);
  result = fixMarkdownIssues(result);
  result = replaceInternalLinks(result, ctx);
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
  const input = markdown.endsWith("\n") ? markdown : `${markdown}\n`;
  const match = input.match(TRANSLATIONS_LIST);
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
