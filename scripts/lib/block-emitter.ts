/**
 * Block emitter — turns normalized, image-rewritten Outline markdown into the
 * typed Block[] stream the app renders (see shared/content-schema.ts).
 *
 * Input contract: the markdown has already been through
 * normalizeOutlineMarkdown (Track B) and updateImageReferences (Track A).
 * Slideset extraction (canonical META: slides + legacy code fences) happens
 * in here, as do the cleanups the OLD runtime applied on every request
 * (lib/docs/loader.ts cleanDocContent + navigation-utils isUnderDevelopment):
 * first-H1 stripping, META line removal, `--- --- ---` tail dropping,
 * under-development markers, Translations block removal.
 *
 * Ordering constraint worth knowing: legacy slideset extraction MUST run
 * before the `--- --- ---` tail drop — the Pictures list that resolves
 * [picN] placeholders lives in that dropped tail.
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import GithubSlugger from "github-slugger";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { toString as mdastToString } from "mdast-util-to-string";
import { getSingletonHighlighter, type BundledLanguage } from "shiki";
import type {
  Block,
  Heading,
  Locale,
  Slide,
  SlideImage,
} from "../../shared/content-schema";
import { markerSource, UNDER_DEVELOPMENT_MARKER } from "./authoring-markers";
import { extractCanonicalSlideset } from "./slideset/canonical";
import { extractLegacySlidesets } from "./slideset/legacy";
import type { RawSlideset } from "./slideset/types";

export interface EmitContext {
  locale: Locale;
  collectionSlug: string;
  /** Rewritten image src -> measured dimensions (from Track A's processor). */
  imageDims: Map<string, { width?: number; height?: number }>;
}

export interface EmitResult {
  blocks: Block[];
  headings: Heading[];
  underDevelopment: boolean;
}

// ---------------------------------------------------------------------------
// Minimal structural mdast/hast typings — the full @types packages are not
// direct dependencies (pnpm isolated layout), and we only touch these fields.
// ---------------------------------------------------------------------------

interface MdNode {
  type: string;
  children?: MdNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
  value?: string;
  url?: string;
  alt?: string | null;
  title?: string | null;
  lang?: string | null;
  meta?: string | null;
  depth?: number;
}

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const mdText = (node: MdNode): string =>
  mdastToString(node as Parameters<typeof mdastToString>[0]);

// ---------------------------------------------------------------------------
// HTML rendering pipeline (shared by html blocks and slide bodies)
// ---------------------------------------------------------------------------

/**
 * Outline image "titles" are size markers like " =1080x2006", not captions.
 * Outline omits the height (" =218x") when only the width was set.
 */
export const SIZE_TITLE_RE = /^\s*=(\d+)x(\d*)\s*$/;

/**
 * Inline <img> carry the Outline size marker as their title (a "=469x366"
 * tooltip); move it to width/height instead.
 */
function rehypeOutlineImageSizes() {
  return (tree: unknown) => {
    const visit = (node: HastNode): void => {
      if (node.type === "element" && node.tagName === "img") {
        const { title, ...rest } = node.properties ?? {};
        const match =
          typeof title === "string" ? SIZE_TITLE_RE.exec(title) : null;
        if (match) {
          node.properties = {
            ...rest,
            width: Number(match[1]),
            ...(match[2] ? { height: Number(match[2]) } : {}),
          };
        }
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree as HastNode);
  };
}

/**
 * External (http/https) links open in a new tab; internal /-prefixed links
 * are left alone for the router. Applied pre-sanitize so the schema's
 * target/rel allowlist is the single gate.
 */
function rehypeExternalLinks() {
  return (tree: unknown) => {
    const visit = (node: HastNode): void => {
      if (node.type === "element" && node.tagName === "a") {
        const href = node.properties?.href;
        if (typeof href === "string" && /^https?:\/\//i.test(href)) {
          node.properties = {
            ...node.properties,
            target: "_blank",
            rel: "noopener noreferrer",
          };
        }
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree as HastNode);
  };
}

/** Text of a hast node and its descendants (what rehype-slug slugs). */
const hastText = (node: HastNode & { value?: string }): string =>
  node.type === "text"
    ? (node.value ?? "")
    : (node.children ?? []).map(hastText).join("");

/**
 * Heading ids from one slugger for the whole page. A page is rendered in
 * pieces (the prose between images, code and slides, and each slide body),
 * and rehype-slug starts counting again in every piece, so two headings
 * with the same text in different pieces got the same id and the TOC link
 * to the second one opened the first. The caller passes the page's slugger
 * in the file data; rehype-slug then skips headings that already have an
 * id, and still slugs a render without one.
 */
function rehypePageSlugs() {
  return (tree: unknown, file: { data: Record<string, unknown> }) => {
    const slugger = file.data.slugger;
    if (!(slugger instanceof GithubSlugger)) return;
    const visit = (node: HastNode): void => {
      if (
        node.type === "element" &&
        /^h[1-6]$/.test(node.tagName ?? "") &&
        !node.properties?.id
      ) {
        node.properties = {
          ...node.properties,
          id: slugger.slug(hastText(node)),
        };
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree as HastNode);
  };
}

/**
 * GitHub default schema, extended:
 * - "id" removed from the clobber list so rehype-slug heading ids survive
 *   unprefixed (TOC anchors must match Heading.id exactly);
 * - a[target|rel] for the external-link pass;
 * - img[alt|width|height|loading];
 * - class on code/pre/span (shiki output shape, future-proofing);
 * - table elements are in the default schema already but pinned explicitly.
 */
const SANITIZE_SCHEMA: typeof defaultSchema = {
  ...defaultSchema,
  clobber: (defaultSchema.clobber ?? []).filter((name) => name !== "id"),
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      "alt",
      "width",
      "height",
      "loading",
    ],
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
    pre: [...(defaultSchema.attributes?.pre ?? []), "className"],
    span: [...(defaultSchema.attributes?.span ?? []), "className"],
  },
  tagNames: [
    ...new Set([
      ...(defaultSchema.tagNames ?? []),
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
    ]),
  ],
};

const htmlProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypePageSlugs)
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, { behavior: "wrap" })
  .use(rehypeExternalLinks)
  .use(rehypeOutlineImageSizes)
  .use(rehypeSanitize, SANITIZE_SCHEMA)
  .use(rehypeStringify);

/**
 * Render a markdown fragment to sanitized HTML (shared pipeline). Pass the
 * page's `slugger` when the fragment is one piece of a page, so heading ids
 * stay unique across the pieces.
 */
export async function renderInlineMarkdown(
  markdown: string,
  slugger?: GithubSlugger,
): Promise<string> {
  const file = await htmlProcessor.process({
    value: markdown,
    data: slugger ? { slugger } : {},
  });
  return String(file).trim();
}

const mdParser = unified().use(remarkParse).use(remarkGfm);

// ---------------------------------------------------------------------------
// Runtime cleanups moved to build time (old lib/docs/loader.ts cleanDocContent)
// ---------------------------------------------------------------------------

/**
 * Authoring marker for unfinished docs. Exported because sync also checks
 * organizer (platform) doc bodies, which never reach emitBlocks.
 */
export function isUnderDevelopment(content: string): boolean {
  return content.toLowerCase().includes(UNDER_DEVELOPMENT_MARKER.toLowerCase());
}

const UNDER_DEVELOPMENT = markerSource(UNDER_DEVELOPMENT_MARKER);

function stripUnderDevelopmentMarkers(md: string): string {
  return md
    .replace(new RegExp(`^${UNDER_DEVELOPMENT}\\s*$`, "gim"), "")
    .replace(new RegExp(UNDER_DEVELOPMENT, "gi"), "");
}

/** Remove the "* Translations:" block (already harvested by extractTranslationLinks). */
function stripTranslationsBlock(md: string): string {
  return md
    .replace(/^---\s*\n\s*\*\s*Translations:[\s\S]*?^---/gm, "")
    .replace(/\* Translations:\s*\n(?:\s*\*\s+\w+:.*\n)+/g, "");
}

/**
 * Authors use a triple horizontal rule as an "end of page" marker; everything
 * below (usually the Pictures list) is dropped. Matches both adjacent and
 * blank-line-separated `---` triplets (the \s* spans blank lines).
 */
function dropAfterTripleHr(md: string): string {
  const match = /\n---\s*\n---\s*\n---\s*\n/.exec(md);
  return match ? md.slice(0, match.index) : md;
}

// ---------------------------------------------------------------------------
// Special block detection
// ---------------------------------------------------------------------------

const SLIDESET_PLACEHOLDER_RE = /^%%SLIDESET:([A-Za-z0-9_-]+)%%$/;

/** Highlightable languages (shiki full-bundle ids/aliases); others render as plaintext. */
const CODE_LANGS = new Set([
  "bash",
  "sh",
  "shell",
  "zsh",
  "shellsession",
  "console",
  "js",
  "javascript",
  "jsx",
  "ts",
  "typescript",
  "tsx",
  "json",
  "jsonc",
  "yaml",
  "yml",
  "toml",
  "ini",
  "python",
  "py",
  "docker",
  "dockerfile",
  "html",
  "css",
  "scss",
  "xml",
  "sql",
  "diff",
  "markdown",
  "md",
  "powershell",
  "ps1",
  "nginx",
  "go",
  "rust",
  "java",
  "kotlin",
  "c",
  "cpp",
  "csharp",
  "php",
  "ruby",
  "swift",
]);

/** Non-whitespace children of a paragraph (Outline pads with stray spaces). */
function significantChildren(node: MdNode): MdNode[] {
  return (node.children ?? []).filter(
    (c) => !(c.type === "text" && (c.value ?? "").trim() === ""),
  );
}

function parseYouTubeId(raw: string): string | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0] || null;
  } else if (
    (host === "youtube.com" || host === "m.youtube.com") &&
    url.pathname === "/watch"
  ) {
    id = url.searchParams.get("v");
  }
  return id && /^[\w-]{6,}$/.test(id) ? id : undefined;
}

function isPdfUrl(raw: string): boolean {
  return raw.split(/[?#]/)[0].toLowerCase().endsWith(".pdf");
}

function withDims(
  src: string,
  dims: { width?: number; height?: number } | undefined,
): SlideImage {
  const image: SlideImage = { src };
  if (dims?.width && Number.isInteger(dims.width) && dims.width > 0) {
    image.width = dims.width;
  }
  if (dims?.height && Number.isInteger(dims.height) && dims.height > 0) {
    image.height = dims.height;
  }
  return image;
}

async function renderCodeBlock(node: MdNode): Promise<Block> {
  const requested = (node.lang ?? "").trim().toLowerCase();
  // Mermaid diagrams: keep the raw source; the client renders it to SVG.
  if (requested === "mermaid" || requested === "mermaidjs") {
    return {
      type: "mermaid",
      code: node.value ?? "",
      ...(node.meta ? { title: node.meta } : {}),
    };
  }
  const lang = CODE_LANGS.has(requested) ? requested : "plaintext";
  // Singleton highlighter: theme/langs are loaded lazily and cached process-wide.
  const highlighter = await getSingletonHighlighter({
    themes: ["one-dark-pro"],
    langs: lang === "plaintext" ? [] : [lang as BundledLanguage],
  });
  const html = highlighter.codeToHtml(node.value ?? "", {
    lang: lang === "plaintext" ? "text" : lang,
    theme: "one-dark-pro",
  });
  return {
    type: "code",
    html,
    lang,
    ...(node.meta ? { title: node.meta } : {}),
  };
}

function imageBlock(img: MdNode, ctx: EmitContext): Block {
  const src = img.url ?? "";
  const title = img.title ?? undefined;
  const sizeMatch = title ? SIZE_TITLE_RE.exec(title) : null;
  const dims =
    ctx.imageDims.get(src) ??
    (sizeMatch
      ? { width: Number(sizeMatch[1]), height: Number(sizeMatch[2]) }
      : undefined);
  const caption = title && !sizeMatch ? title.trim() : undefined;
  const { width, height } = withDims(src, dims);
  return {
    type: "image",
    src,
    alt: (img.alt ?? "").trim(),
    ...(caption ? { caption } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };
}

async function renderSlidesetBlock(
  raw: RawSlideset,
  ctx: EmitContext,
  slugger: GithubSlugger,
): Promise<Block> {
  const slides: Slide[] = [];
  for (const slide of raw.slides) {
    slides.push({
      ...(slide.title ? { title: slide.title } : {}),
      layout: slide.layout,
      html: slide.bodyMarkdown
        ? await renderInlineMarkdown(slide.bodyMarkdown, slugger)
        : "",
      images: slide.imageRefs.map((src) =>
        withDims(src, ctx.imageDims.get(src)),
      ),
    });
  }
  return {
    type: "slideset",
    source: raw.source,
    ...(raw.title ? { title: raw.title } : {}),
    slides,
  };
}

/**
 * Returns the special Block for a top-level node, or undefined when the node
 * belongs to the surrounding prose run. Unknown %%SLIDESET%% ids fall through
 * to prose on purpose — a visible placeholder beats silently lost content.
 */
async function toSpecialBlock(
  node: MdNode,
  ctx: EmitContext,
  slidesets: Map<string, RawSlideset>,
  renderSlides: (raw: RawSlideset) => Promise<Block>,
): Promise<Block | undefined> {
  if (node.type === "code") return renderCodeBlock(node);
  if (node.type !== "paragraph") return undefined;

  const children = significantChildren(node);
  if (children.length !== 1) return undefined;
  const child = children[0];

  if (child.type === "text") {
    const match = SLIDESET_PLACEHOLDER_RE.exec((child.value ?? "").trim());
    if (match) {
      const raw = slidesets.get(match[1]);
      if (raw) return renderSlides(raw);
    }
    return undefined;
  }

  if (child.type === "image") return imageBlock(child, ctx);

  if (child.type === "link" && child.url) {
    const text = mdText(child).trim();
    const url = child.url;
    // "Bare" URL paragraphs only (gfm autolinks and <url> normalization
    // produce text === url); authored [label](url) links stay prose.
    if (text === url) {
      const videoId = parseYouTubeId(url);
      if (videoId) return { type: "youtube", videoId };
    }
    if (isPdfUrl(url)) {
      // Old convertPDFLinksToPreview stripped trailing file-size digits.
      const title = text !== url ? text.replace(/\s+\d+$/, "").trim() : "";
      return { type: "pdf", src: url, ...(title ? { title } : {}) };
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Heading collection
// ---------------------------------------------------------------------------

/**
 * Pair mdast h2/h3 nodes of a prose run with the heading ids in
 * the rendered HTML (same document order on both sides), so TOC anchors are
 * exact by construction instead of re-implementing the slugger.
 */
function collectHeadings(run: MdNode[], html: string): Heading[] {
  const mdHeadings = run.filter(
    (n) => n.type === "heading" && (n.depth === 2 || n.depth === 3),
  );
  if (mdHeadings.length === 0) return [];

  const out: Heading[] = [];
  const tagRe = /<h([23])\b[^>]*>/g;
  let i = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html)) !== null && i < mdHeadings.length) {
    const node = mdHeadings[i++];
    const id = /\sid="([^"]*)"/.exec(match[0])?.[1];
    if (!id) continue; // empty slug (e.g. all-symbol heading) — no anchor
    out.push({
      depth: node.depth === 3 ? 3 : 2,
      text: mdText(node).trim(),
      id,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function emitBlocks(
  markdown: string,
  ctx: EmitContext,
): Promise<EmitResult> {
  const underDevelopment = isUnderDevelopment(markdown);

  let md = markdown.replace(/^---\n[\s\S]*?\n---\n*/, ""); // defensive frontmatter strip
  md = stripUnderDevelopmentMarkers(md);
  md = stripTranslationsBlock(md);

  // (a) slideset extraction — canonical first, then legacy on the remainder.
  const slidesets = new Map<string, RawSlideset>();
  const canonical = extractCanonicalSlideset(md);
  md = canonical.markdown;
  const legacy = extractLegacySlidesets(md);
  md = legacy.markdown;
  for (const [id, set] of legacy.slidesets) slidesets.set(id, set);

  // (b) old cleanDocContent semantics.
  md = md.replace(/^#\s+.+$/m, ""); // first H1 (title is rendered separately)
  md = md.replace(/^META:.*$/gim, ""); // any remaining META marker lines
  md = dropAfterTripleHr(md);

  // The canonical slideset renders after the (already tail-trimmed) intro.
  if (canonical.slideset) {
    slidesets.set("canonical", canonical.slideset);
    md += "\n\n%%SLIDESET:canonical%%\n";
  }
  md = md.replace(/\n{3,}/g, "\n\n");

  const root = mdParser.parse(md) as unknown as MdNode;
  const blocks: Block[] = [];
  const headings: Heading[] = [];
  const slugger = new GithubSlugger();
  let run: MdNode[] = [];

  const flushRun = async (): Promise<void> => {
    if (run.length === 0) return;
    const start = run[0].position?.start.offset;
    const end = run[run.length - 1].position?.end.offset;
    const slice =
      start != null && end != null
        ? md.slice(start, end)
        : run.map(mdText).join("\n\n");
    const nodes = run;
    run = [];
    const html = await renderInlineMarkdown(slice, slugger);
    if (!html) return;
    headings.push(...collectHeadings(nodes, html));
    blocks.push({ type: "html", html });
  };

  const renderSlides = async (raw: RawSlideset): Promise<Block> => {
    await flushRun(); // the prose above takes its heading ids first
    return renderSlidesetBlock(raw, ctx, slugger);
  };

  for (const node of root.children ?? []) {
    const special = await toSpecialBlock(node, ctx, slidesets, renderSlides);
    if (special) {
      await flushRun();
      blocks.push(special);
    } else {
      run.push(node);
    }
  }
  await flushRun();

  return { blocks, headings, underDevelopment };
}
