/**
 * Legacy slideshow extraction — the ```markdown / ```reveal fence convention.
 *
 * Authors write slides inside a code fence (slides separated by `---` lines)
 * and define the referenced images in a "Pictures" list somewhere below the
 * fence (usually after a `--- --- ---` separator so the old runtime dropped
 * it from the rendered page). The Pictures list grew EIGHT tolerated format
 * variants over the years (A-H below); the line parser is ported
 * regex-byte-identical from the old scripts/lib/markdown-processor.ts
 * (convertToSlideshow) / scripts/fix-slideshows.ts.
 *
 * Differences from the old code, on purpose:
 * - Fences are located with a line-based scanner instead of the old global
 *   regex. The old regex could pair the CLOSING fence of e.g. a ```bash block
 *   with the next opening fence and swallow the prose in between; the
 *   line-based scan handles well-formed input identically without that
 *   hazard. Accepted openers are unchanged: bare ```, ```markdown, ```reveal
 *   — but only when the document contains at least one explicit
 *   ```markdown/```reveal fence (the old early-exit gate).
 * - Non-slide fences are left untouched (the old code rewrote their language
 *   tag to "markdown" as a side effect of the replacement regex).
 * - The Pictures list is consumed (removed from the remaining markdown);
 *   the old pipeline left it in and relied on the runtime's `--- --- ---`
 *   tail-dropping to hide it. To avoid eating prose, a line is only removed
 *   once it actually participated in a successful key->image mapping.
 */
import {
  SlideLayoutSchema,
  type SlideLayout,
} from "../../../shared/content-schema";
import type { RawSlide, RawSlideset } from "./types";

/** Old early-exit gate: only documents with an explicit slide fence are processed. */
const GATE_FENCE_RE = /^```(?:markdown|reveal)\s*$/;
/** Fence openers eligible for slide conversion (old regex accepted a bare ``` too). */
const SLIDE_FENCE_OPEN_RE = /^```(?:markdown|reveal)?\s*$/;
const ANY_FENCE_OPEN_RE = /^```/;
const FENCE_CLOSE_RE = /^```\s*$/;
/** "## Pictures:" / "Pictures" / "**Pictures:**" heading above the list. */
const PICTURES_HEADING_RE = /^#{0,6}\s*\**\s*pictures:?\s*\**\s*$/i;

interface FenceRange {
  /** Opening fence line index. */
  open: number;
  /** Closing fence line index. */
  close: number;
  isSlideCandidate: boolean;
}

/** Extract the first valid (rooted or absolute) image URL from a fragment. */
function extractUrl(fragment: string): string | null {
  const imgPattern = /!\[\]\(([^ \t)"]+)(?:\s+"[^"]*")?\)/g;
  let imgMatch: RegExpExecArray | null;
  let lastUrl: string | null = null;
  while ((imgMatch = imgPattern.exec(fragment)) !== null) {
    const u = imgMatch[1];
    if (u && (u.startsWith("/") || u.startsWith("http"))) {
      lastUrl = u;
    }
  }
  return lastUrl;
}

/** Collect all valid image URLs from a fragment (a line may hold several). */
function extractAllUrls(fragment: string): string[] {
  const imgPattern = /!\[\]\(([^ \t)"]+)(?:\s+"[^"]*")?\)/g;
  const urls: string[] = [];
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgPattern.exec(fragment)) !== null) {
    const u = imgMatch[1];
    if (u && (u.startsWith("/") || u.startsWith("http"))) {
      urls.push(u);
    }
  }
  return urls;
}

/**
 * Line-by-line Pictures-list parser. Handles all known formats:
 *   A  "* pic1![](/path " =WxH")"      — inline, single bullet
 *   B  "* pic_key\n  \n  ![](/path)"   — key and image on separate lines
 *   C  bare "pic1\n![](/path)"         — no bullet at all
 *   D  "pic1\n![](img1)pic2\n![](img2)" — reverse: image shares a line with
 *      the NEXT key but belongs to the PREVIOUS one
 *   E  "pic1 ![](img1)pic2 ![](img2)"  — all pairs concatenated on one line
 *   F  "pic1  ![](img1)"               — key + image same line, spaced
 *   G  "* * pic1\n    ![](/path)"      — nested double-bullet (fi/sv exports)
 *   H  "pic 8" / "[pic 8]"             — space inside the key, normalized to
 *      "pic8" here and in slide content
 *
 * First definition of a key wins (old behavior). `consumed` holds indexes of
 * lines that participated in a successful mapping — only those are removed
 * from the document.
 */
function parsePicturesList(lines: string[]): {
  imageMap: Record<string, string>;
  consumed: Set<number>;
} {
  const imageMap: Record<string, string> = {};
  const consumed = new Set<number>();
  let currentPicKey: string | null = null;
  let currentPicKeyLine = -1;

  const setKey = (key: string | null, lineIdx: number) => {
    currentPicKey = key;
    currentPicKeyLine = key === null ? -1 : lineIdx;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    // Strip ALL leading bullet markers (* - +) and whitespace, any nesting depth
    const stripped = line.replace(/^[\s*\-+]+/, "").trim();

    // Case 1 (B/C/G/H): line is ONLY a pic key (bare or bulleted at any depth).
    // "pic 8" (space variant) is normalized to "pic8".
    const bareKeyMatch = stripped.match(/^(pic[\w ]+)\s*$/i);
    if (bareKeyMatch) {
      setKey(bareKeyMatch[1].replace(/\s+/g, ""), idx);
      continue;
    }

    // Case E: single line with multiple concatenated key+image pairs.
    const multiPairPattern = /(pic[\w]+)\s*(!\[\]\([^)]+\))/gi;
    const multiPairMatches = [...stripped.matchAll(multiPairPattern)];
    if (multiPairMatches.length > 1) {
      let mappedAny = false;
      for (const mp of multiPairMatches) {
        const key = mp[1];
        const url = extractUrl(mp[2]);
        if (url) {
          mappedAny = true;
          if (!imageMap[key]) imageMap[key] = url;
        }
      }
      if (mappedAny) consumed.add(idx);
      setKey(null, idx);
      continue;
    }

    // Case 2 (A/F): key followed by an image on the same line, optionally
    // separated by whitespace or a literal "\n" from a broken export.
    const inlineMatch = stripped.match(/^(pic[\w]+)(?:\\n|\s)*(!\[\]\(.+)$/i);
    if (inlineMatch) {
      const key = inlineMatch[1];
      const url = extractUrl(inlineMatch[2]);
      if (url) {
        if (!imageMap[key]) imageMap[key] = url;
        consumed.add(idx);
      }
      setKey(null, idx);
      continue;
    }

    // Case 3 (B/C/D/G): line carries image(s).
    if (line.includes("![](") || line.includes("![\\]\\(")) {
      const urlsOnLine = extractAllUrls(line);

      // Keys that appear AFTER an image on this line (Format D — reverse)
      const afterImageKeyPattern = /!\[\]\([^)]+\)\s*(pic[\w]+)/gi;
      const keysAfterImages: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = afterImageKeyPattern.exec(line)) !== null) {
        keysAfterImages.push(m[1]);
      }

      const lineStripped = line.replace(/^[\s*\-+]+/, "").trim();
      const startsWithImage = lineStripped.startsWith("![](");

      if (startsWithImage && currentPicKey && urlsOnLine.length > 0) {
        // First image on the line belongs to the pending key
        if (!imageMap[currentPicKey]) {
          imageMap[currentPicKey] = urlsOnLine[0];
        }
        consumed.add(idx);
        if (currentPicKeyLine >= 0) consumed.add(currentPicKeyLine);
        setKey(null, idx);

        if (keysAfterImages.length > 0) {
          // Walk subsequent (key, image) pairs on this line; a trailing key
          // without an image becomes the pending key for the next line.
          const segments = line.split(/(!\[\]\([^)]+\))/);
          let seenFirstImage = false;
          let pendingKey: string | null = null;

          for (const seg of segments) {
            if (/^!\[\]\([^)]+\)$/.test(seg)) {
              const segUrl = extractUrl(seg);
              if (seenFirstImage && pendingKey && segUrl) {
                if (!imageMap[pendingKey]) imageMap[pendingKey] = segUrl;
                pendingKey = null;
              }
              seenFirstImage = true;
            } else {
              const keyAtStart = seg
                .replace(/^[\s*\-+]+/, "")
                .match(/^(pic[\w]+)/i);
              if (keyAtStart) pendingKey = keyAtStart[1];
            }
          }
          setKey(pendingKey, idx);
        }
        continue;
      }

      // Standard case (B/C/G): image on a line after the key
      if (currentPicKey) {
        const url = urlsOnLine[0];
        if (url && !imageMap[currentPicKey]) {
          imageMap[currentPicKey] = url;
          consumed.add(idx);
          if (currentPicKeyLine >= 0) consumed.add(currentPicKeyLine);
          setKey(null, idx);
        }
        continue;
      }
    }

    // Any other non-empty, non-continuation line resets the pending key.
    // Blank lines and Outline's lone "\" continuation lines do NOT reset —
    // Format B depends on that.
    if (line.trim() !== "" && line.trim() !== "\\" && !line.includes("![](")) {
      setKey(null, idx);
    }
  }

  return { imageMap, consumed };
}

/** Normalize "[pic N]" (space inside the key) -> "[picN]" so refs match map keys. */
function normalizeSlideKeys(content: string): string {
  return content.replace(/\[pic\s+(\d+)\]/g, "[pic$1]");
}

function resolveLayout(raw: string, imageCount: number): SlideLayout {
  if ((SlideLayoutSchema.options as readonly string[]).includes(raw)) {
    return raw as SlideLayout;
  }
  return imageCount > 0 ? "image-bottom" : "text";
}

/**
 * Parse one slide section, porting the old runtime RevealSlideshow.parseSlide
 * semantics to build time:
 * - first non-empty "#" heading becomes the title;
 * - "[layout: ...]" sets the layout ("split" was already normalized to
 *   image-right by the old build step, so the runtime's split->image-left
 *   branch was dead code — we keep the build-time mapping);
 * - "[picN]" lines resolve to image URLs via the Pictures map;
 * - inline picture definitions ("* picN![](...)") and any further "#" lines
 *   are dropped;
 * - everything else is slide body markdown (one line per bullet/paragraph).
 */
function parseSlide(
  slideText: string,
  imageMap: Record<string, string>,
): RawSlide {
  const lines = slideText.trim().split("\n");
  let title: string | undefined;
  let layoutRaw = "default";
  const content: string[] = [];
  const imageRefs: string[] = [];
  let titleFound = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("#") && !titleFound) {
      const potentialTitle = trimmed.replace(/^#+\s*/, "").trim();
      if (potentialTitle) {
        title = potentialTitle;
        titleFound = true;
        continue;
      }
    }

    if (trimmed.startsWith("[layout:")) {
      layoutRaw = (trimmed.match(/:(.*?)]/)?.[1] || "default").trim();
      if (layoutRaw === "split") layoutRaw = "image-right";
      continue;
    }

    if (/^\[pic\d+\]$/.test(trimmed)) {
      const key = trimmed.replace(/[[\]]/g, "");
      const url = imageMap[key];
      if (url) imageRefs.push(url);
      continue;
    }

    if (/^[*+-]\s+pic\d+!\[\]\(/.test(trimmed)) continue;
    if (trimmed.startsWith("#")) continue;

    // Keep blank lines: a blank between a bullet list and following prose is
    // the paragraph break that makes the prose its own block (with a gap)
    // instead of lazy-joining onto the last bullet.
    content.push(trimmed);
  }

  return {
    title,
    layout: resolveLayout(layoutRaw, imageRefs.length),
    // Collapse blank-line runs and trim the edges so only intentional
    // single-blank paragraph breaks survive.
    bodyMarkdown: content
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    imageRefs,
  };
}

/** Parse a slide fence body into slides (split on `---` rule lines, as the old runtime did). */
function parseFenceContent(
  content: string,
  imageMap: Record<string, string>,
): RawSlide[] {
  const normalized = normalizeSlideKeys(
    content.replace(/\[layout:\s*split\]/g, "[layout: image-right]"),
  );
  return normalized
    .split(/\n\s*---\s*\n/)
    .filter((s) => s.trim().length > 0)
    .map((s) => parseSlide(s, imageMap));
}

/** Locate fenced code blocks; non-slide fences must pass through untouched. */
function scanFences(lines: string[]): FenceRange[] {
  const fences: FenceRange[] = [];
  let i = 0;
  while (i < lines.length) {
    if (ANY_FENCE_OPEN_RE.test(lines[i])) {
      let close = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (FENCE_CLOSE_RE.test(lines[j])) {
          close = j;
          break;
        }
      }
      if (close === -1) break; // unterminated fence — leave the rest alone
      fences.push({
        open: i,
        close,
        isSlideCandidate: SLIDE_FENCE_OPEN_RE.test(lines[i]),
      });
      i = close + 1;
    } else {
      i++;
    }
  }
  return fences;
}

/**
 * Replace each slide fence with a `%%SLIDESET:<id>%%` placeholder line and
 * consume the Pictures list. Returns the remaining markdown plus the parsed
 * slidesets keyed by placeholder id ("legacy-0", "legacy-1", ...).
 */
export function extractLegacySlidesets(markdown: string): {
  markdown: string;
  slidesets: Map<string, RawSlideset>;
} {
  const slidesets = new Map<string, RawSlideset>();
  const lines = markdown.split("\n");

  // Old early-exit gate: no explicit ```markdown/```reveal fence -> untouched.
  if (!lines.some((l) => GATE_FENCE_RE.test(l))) {
    return { markdown, slidesets };
  }

  const fences = scanFences(lines);
  const inFence = new Set<number>();
  for (const f of fences) {
    for (let i = f.open; i <= f.close; i++) inFence.add(i);
  }

  // The old parser scanned the WHOLE document (fence content included — some
  // docs define pictures inline in slides), so the map is built from all
  // lines. Removal only ever applies outside fences.
  const { imageMap, consumed } = parsePicturesList(lines);

  // Identify slide fences (>= 1 `---` rule inside, old threshold).
  const slideFences = new Map<number, RawSlideset>(); // open line -> slideset
  for (const f of fences) {
    if (!f.isSlideCandidate) continue;
    const content = lines.slice(f.open + 1, f.close).join("\n");
    const hrCount = (content.match(/^---$/gm) || []).length;
    if (hrCount < 1) continue;
    const slides = parseFenceContent(content, imageMap);
    if (slides.length === 0) continue;
    slideFences.set(f.open, { source: "legacy", slides });
  }
  if (slideFences.size === 0) {
    return { markdown, slidesets };
  }

  // Consume the "Pictures" heading when the list right below it was consumed.
  const headingConsumed = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (inFence.has(i) || !PICTURES_HEADING_RE.test(lines[i].trim())) continue;
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t === "" || t === "\\") continue;
      if (consumed.has(j) && !inFence.has(j)) headingConsumed.add(i);
      break;
    }
  }

  const fenceByOpen = new Map(fences.map((f) => [f.open, f]));
  const out: string[] = [];
  let counter = 0;
  let i = 0;
  while (i < lines.length) {
    const fence = fenceByOpen.get(i);
    if (fence) {
      const slideset = slideFences.get(fence.open);
      if (slideset) {
        const id = `legacy-${counter++}`;
        slidesets.set(id, slideset);
        // Blank lines guarantee the placeholder parses as its own paragraph.
        out.push("", `%%SLIDESET:${id}%%`, "");
      } else {
        out.push(...lines.slice(fence.open, fence.close + 1));
      }
      i = fence.close + 1;
      continue;
    }
    if (!(consumed.has(i) && !inFence.has(i)) && !headingConsumed.has(i)) {
      out.push(lines[i]);
    }
    i++;
  }

  return { markdown: out.join("\n"), slidesets };
}
