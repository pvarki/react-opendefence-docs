/**
 * Pure helpers for the PPTX exporter (scripts/export-pptx.ts): map the
 * slideset HTML (emitted by block-emitter, sanitized — tag corpus is exactly
 * p/ul/ol/li/strong/em/code/a/hr) to pptxgenjs text runs, and fit images
 * into slide regions aspect-aware. No I/O here so pptx.test.ts stays trivial.
 */

// --- text model --------------------------------------------------------------

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Render in a monospace face (<code>). */
  mono?: boolean;
  /** Absolute hyperlink target. */
  href?: string;
  /** Outline-internal link (/doc/…): styled but not linked. */
  underline?: boolean;
  /** Line break (<br>) before this run, within the same paragraph. */
  softBreak?: boolean;
}

export interface Para {
  runs: Run[];
  bullet?: true | { type: "number" };
  /** 0 = plain paragraph; 1+ = list nesting depth. */
  indent: number;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decode numeric (&#x26; / &#38;) and common named entities. */
export function decodeEntities(s: string): string {
  return s.replace(
    /&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g,
    (match, body: string) => {
      if (body.startsWith("#")) {
        const hex = body[1] === "x" || body[1] === "X";
        const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return NAMED_ENTITIES[body.toLowerCase()] ?? match;
    },
  );
}

/**
 * Tokenize the machine-generated slide HTML into paragraphs of styled runs.
 * ponytail: regex tokenizer, not a real HTML parser — safe because the input
 * is our own rehype-sanitize output; unknown tags are stripped with a warn.
 */
export function htmlToParas(html: string): Para[] {
  const paras: Para[] = [];
  const listStack: ("ul" | "ol")[] = [];
  let bold = 0;
  let italic = 0;
  let mono = 0;
  let href: string | undefined;
  let current: Para | null = null;
  let pendingBreak = false;
  const warned = new Set<string>();

  const flush = () => {
    if (current && current.runs.length > 0) paras.push(current);
    current = null;
    pendingBreak = false;
  };

  for (const token of html.split(/(<[^>]+>)/)) {
    if (!token) continue;

    if (token.startsWith("<")) {
      const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>$/.exec(token);
      if (!m) continue;
      const closing = m[1] === "/";
      const tag = m[2].toLowerCase();

      switch (tag) {
        case "p":
          if (closing) flush();
          else if (current?.bullet && current.runs.length === 0) {
            // Loose list (<li><p>…): keep the just-opened bullet paragraph
            // so the <p> text flows into it instead of losing the bullet.
          } else {
            flush();
            current = { runs: [], indent: 0 };
          }
          break;
        case "ul":
        case "ol":
          flush();
          if (closing) listStack.pop();
          else listStack.push(tag);
          break;
        case "li":
          if (closing) flush();
          else {
            flush();
            const listType = listStack[listStack.length - 1] ?? "ul";
            current = {
              runs: [],
              bullet: listType === "ol" ? { type: "number" } : true,
              indent: Math.max(1, listStack.length),
            };
          }
          break;
        case "hr":
          flush();
          paras.push({ runs: [{ text: "" }], indent: 0 });
          break;
        case "br":
          // Soft line break within the paragraph — keeps bullet/indent context.
          if (current && current.runs.length > 0) pendingBreak = true;
          break;
        case "strong":
        case "b":
          bold += closing ? -1 : 1;
          break;
        case "em":
        case "i":
          italic += closing ? -1 : 1;
          break;
        case "code":
          mono += closing ? -1 : 1;
          break;
        case "a":
          if (closing) href = undefined;
          else {
            const hrefMatch = /href="([^"]*)"/.exec(m[3]);
            href = hrefMatch ? decodeEntities(hrefMatch[1]) : undefined;
          }
          break;
        default:
          if (!warned.has(tag)) {
            warned.add(tag);
            console.warn(
              `[pptx] unhandled HTML tag <${tag}> — text kept, formatting dropped`,
            );
          }
      }
      continue;
    }

    const text = decodeEntities(token).replace(/\s+/g, " ");
    if (text.trim() === "") {
      // Inter-tag newlines are noise, but a lone space between inline runs
      // ("</strong> <em>") is a word separator — keep it inside an open para.
      if (current && current.runs.length > 0 && text.includes(" ")) {
        current.runs.push({ text: " " });
      }
      continue;
    }

    current ??= { runs: [], indent: 0 };
    const run: Run = { text };
    if (pendingBreak) {
      run.softBreak = true;
      pendingBreak = false;
    }
    if (bold > 0) run.bold = true;
    if (italic > 0) run.italic = true;
    if (mono > 0) run.mono = true;
    if (href) {
      if (/^https?:\/\//i.test(href)) run.href = href;
      else run.underline = true; // Outline-internal /doc/… — nothing to link to
    }
    current.runs.push(run);
  }

  flush();
  return paras;
}

// --- pptxgenjs text props -----------------------------------------------------

/** Structurally matches pptxgenjs's TextProps ({ text, options }). */
export interface TextRunProps {
  text: string;
  options: {
    bold?: boolean;
    italic?: boolean;
    fontFace?: string;
    underline?: { style: "sng" };
    hyperlink?: { url: string };
    bullet?: boolean | { type: "number" };
    indentLevel?: number;
    breakLine?: boolean;
    softBreakBefore?: boolean;
    paraSpaceAfter?: number;
  };
}

/**
 * Flatten paragraphs to a pptxgenjs addText() array: paragraph-level options
 * (bullet, indent, spacing) ride on the first run, breakLine on the last.
 */
export function parasToTextProps(paras: Para[]): TextRunProps[] {
  const out: TextRunProps[] = [];
  for (const para of paras) {
    const runs = para.runs.length > 0 ? para.runs : [{ text: "" } as Run];
    runs.forEach((run, i) => {
      const options: TextRunProps["options"] = {};
      if (i === 0) {
        options.bullet = para.bullet ?? false;
        if (para.bullet) options.indentLevel = Math.max(0, para.indent - 1);
        options.paraSpaceAfter = para.bullet ? 4 : 8;
      }
      if (i === runs.length - 1) options.breakLine = true;
      if (run.softBreak) options.softBreakBefore = true;
      if (run.bold) options.bold = true;
      if (run.italic) options.italic = true;
      if (run.mono) options.fontFace = "Courier New";
      if (run.href) options.hyperlink = { url: run.href };
      if (run.underline) options.underline = { style: "sng" };
      out.push({ text: run.text, options });
    });
  }
  return out;
}

// --- slide geometry ------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Fit an image (intrinsic px, 96 dpi native) inside a box (inches), keeping
 * aspect, centering both axes, never upscaling past native size.
 */
export function fitRect(
  intrinsicW: number,
  intrinsicH: number,
  box: Rect,
): Rect {
  const nativeW = intrinsicW / 96;
  const nativeH = intrinsicH / 96;
  const scale = Math.min(box.w / nativeW, box.h / nativeH, 1);
  const w = nativeW * scale;
  const h = nativeH * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

const FONT_STEPS = [15, 14, 13, 12, 11, 10, 9];

/**
 * Pick the largest font size whose estimated text height fits the box.
 * pptxgenjs's fit:"shrink" only emits a bare <a:normAutofit/>, which desktop
 * PowerPoint honors on next edit but read-only viewers (SharePoint 2013 /
 * Office Web Apps — our target) render as stored, so overflow must be
 * prevented up front. ponytail: character-count heuristic with conservative
 * Calibri-ish metrics (0.5 em avg glyph, 1.25 em lines), not real text layout.
 */
export function fitFontSize(
  paras: Para[],
  box: Rect,
  sizes: number[] = FONT_STEPS,
): number {
  for (const size of sizes) {
    let heightPt = 0;
    for (const p of paras) {
      const chars = p.runs.reduce((n, r) => n + r.text.length, 0);
      const indentIn = p.bullet ? 0.35 + 0.25 * Math.max(0, p.indent - 1) : 0;
      const widthPt = Math.max(36, (box.w - 0.1 - indentIn) * 72);
      const charsPerLine = widthPt / (size * 0.5);
      const softBreaks = p.runs.filter((r) => r.softBreak).length;
      const lines = Math.max(1, Math.ceil(chars / charsPerLine)) + softBreaks;
      heightPt += lines * size * 1.25 + (p.bullet ? 4 : 8);
    }
    if (heightPt / 72 <= box.h * 0.95) return size;
  }
  return sizes[sizes.length - 1];
}

export interface SlideGeometry {
  title: Rect;
  body: Rect;
  image?: Rect;
}

const TITLE: Rect = { x: 0.5, y: 0.3, w: 12.33, h: 0.8 };

/** 16:9 layout boxes per slideset layout. grid (unused in corpus) ≈ image-bottom. */
export const GEOM: Record<string, SlideGeometry> = {
  text: {
    title: TITLE,
    body: { x: 0.5, y: 1.3, w: 12.33, h: 5.9 },
  },
  "image-left": {
    title: TITLE,
    image: { x: 0.5, y: 1.3, w: 3.4, h: 5.9 },
    body: { x: 4.2, y: 1.3, w: 8.63, h: 5.9 },
  },
  "image-right": {
    title: TITLE,
    image: { x: 9.43, y: 1.3, w: 3.4, h: 5.9 },
    body: { x: 0.5, y: 1.3, w: 8.63, h: 5.9 },
  },
  "image-bottom": {
    title: TITLE,
    body: { x: 0.5, y: 1.15, w: 12.33, h: 1.85 },
    image: { x: 0.5, y: 3.1, w: 12.33, h: 4.15 },
  },
};
GEOM.grid = GEOM["image-bottom"];
