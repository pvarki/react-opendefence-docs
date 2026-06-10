import { describe, expect, it } from "vitest";
import {
  emitBlocks,
  renderInlineMarkdown,
  type EmitContext,
} from "./block-emitter";
import {
  BlockSchema,
  HeadingSchema,
  type Block,
} from "../../shared/content-schema";

const ctx = (
  imageDims: Record<string, { width?: number; height?: number }> = {},
): EmitContext => ({
  locale: "en",
  collectionSlug: "deploy-app",
  imageDims: new Map(Object.entries(imageDims)),
});

const blockTypes = (blocks: Block[]): string[] => blocks.map((b) => b.type);

describe("emitBlocks end-to-end", () => {
  const FIXTURE = [
    "# Page Title",
    "",
    "(this page is under development)",
    "",
    "---",
    "",
    "* Translations:",
    "  * en: [X](/doc/foo-Ab12Cd34)",
    "  * fi: [X](/doc/bar-Ef56Gh78)",
    "",
    "---",
    "",
    "Intro with an [external](https://example.com) link and <script>alert(1)</script> tag.",
    "",
    "## Section One",
    "",
    "Some prose.",
    "",
    "```bash",
    'echo "hello"',
    "```",
    "",
    '![A screenshot](/content/images/en/attachments/abc.webp " =100x200")',
    "",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "",
    "[Manual 123](/content/images/en/attachments/file.pdf)",
    "",
    "### Sub Section",
    "",
    "```markdown",
    "# Slide 1",
    "- step one",
    "[pic1]",
    "---",
    "# Slide 2",
    "[layout: split]",
    "- step two",
    "[pic2]",
    "```",
    "",
    "After-slides prose.",
    "",
    "---",
    "",
    "---",
    "",
    "---",
    "",
    "## Pictures:",
    "",
    '* pic1![](/content/images/en/attachments/p1.webp " =10x20")',
    "* pic2![](/content/images/en/attachments/p2.webp)",
    "",
    "Dropped tail prose.",
    "",
  ].join("\n");

  it("emits blocks and headings that validate against the shared schemas", async () => {
    const { blocks, headings } = await emitBlocks(FIXTURE, ctx());
    for (const block of blocks) BlockSchema.parse(block);
    for (const heading of headings) HeadingSchema.parse(heading);
  });

  it("emits the exact block sequence", async () => {
    const { blocks } = await emitBlocks(FIXTURE, ctx());
    expect(blockTypes(blocks)).toEqual([
      "html", // intro + Section One heading + prose
      "code",
      "image",
      "youtube",
      "pdf",
      "html", // Sub Section heading
      "slideset",
      "html", // after-slides prose
    ]);
  });

  it("detects and removes the under-development marker", async () => {
    const { blocks, underDevelopment } = await emitBlocks(FIXTURE, ctx());
    expect(underDevelopment).toBe(true);
    const allHtml = blocks
      .filter((b) => b.type === "html")
      .map((b) => b.html)
      .join("");
    expect(allHtml.toLowerCase()).not.toContain("under development");
  });

  it("strips the first H1, the Translations block and the post-triple-HR tail", async () => {
    const { blocks } = await emitBlocks(FIXTURE, ctx());
    const allHtml = JSON.stringify(blocks);
    expect(allHtml).not.toContain("Page Title");
    expect(allHtml).not.toContain("Translations");
    expect(allHtml).not.toContain("Dropped tail prose");
    expect(allHtml).not.toContain("Pictures");
  });

  it("sanitizes HTML (script stripped) and marks external links", async () => {
    const { blocks } = await emitBlocks(FIXTURE, ctx());
    const intro = blocks[0];
    if (intro.type !== "html") throw new Error("expected html block");
    expect(intro.html).not.toContain("<script>");
    expect(intro.html).toContain('href="https://example.com"');
    expect(intro.html).toContain('target="_blank"');
    expect(intro.html).toContain('rel="noopener noreferrer"');
  });

  it("collects depth 2-3 headings with rehype-slug-matching ids", async () => {
    const { blocks, headings } = await emitBlocks(FIXTURE, ctx());
    expect(headings).toEqual([
      { depth: 2, text: "Section One", id: "section-one" },
      { depth: 3, text: "Sub Section", id: "sub-section" },
    ]);
    const intro = blocks[0];
    if (intro.type !== "html") throw new Error("expected html block");
    expect(intro.html).toContain('id="section-one"');
  });

  it("renders code fences with shiki (one-dark-pro)", async () => {
    const { blocks } = await emitBlocks(FIXTURE, ctx());
    const code = blocks[1];
    if (code.type !== "code") throw new Error("expected code block");
    expect(code.lang).toBe("bash");
    expect(code.html).toContain("shiki");
    expect(code.html).toContain("one-dark-pro");
    expect(code.html).toContain("<pre");
  });

  it("emits image blocks with dims parsed from Outline size titles", async () => {
    const { blocks } = await emitBlocks(FIXTURE, ctx());
    expect(blocks[2]).toEqual({
      type: "image",
      src: "/content/images/en/attachments/abc.webp",
      alt: "A screenshot",
      width: 100,
      height: 200,
    });
  });

  it("prefers measured dims from ctx.imageDims over size titles", async () => {
    const { blocks } = await emitBlocks(
      FIXTURE,
      ctx({
        "/content/images/en/attachments/abc.webp": { width: 640, height: 480 },
      }),
    );
    expect(blocks[2]).toMatchObject({ width: 640, height: 480 });
  });

  it("emits youtube and pdf blocks", async () => {
    const { blocks } = await emitBlocks(FIXTURE, ctx());
    expect(blocks[3]).toEqual({ type: "youtube", videoId: "dQw4w9WgXcQ" });
    expect(blocks[4]).toEqual({
      type: "pdf",
      src: "/content/images/en/attachments/file.pdf",
      title: "Manual", // trailing file-size digits stripped (old behavior)
    });
  });

  it("resolves the legacy slideset with rendered slide html and image dims", async () => {
    const { blocks } = await emitBlocks(
      FIXTURE,
      ctx({
        "/content/images/en/attachments/p1.webp": { width: 10, height: 20 },
      }),
    );
    const slideset = blocks[6];
    if (slideset.type !== "slideset") throw new Error("expected slideset");
    expect(slideset.source).toBe("legacy");
    expect(slideset.slides).toHaveLength(2);
    expect(slideset.slides[0].title).toBe("Slide 1");
    expect(slideset.slides[0].layout).toBe("image-bottom");
    expect(slideset.slides[0].html).toContain("step one");
    expect(slideset.slides[0].images).toEqual([
      { src: "/content/images/en/attachments/p1.webp", width: 10, height: 20 },
    ]);
    expect(slideset.slides[1].layout).toBe("image-right"); // split normalized
    expect(slideset.slides[1].images).toEqual([
      { src: "/content/images/en/attachments/p2.webp" },
    ]);
  });
});

describe("emitBlocks canonical slidesets", () => {
  it("emits intro html followed by the canonical slideset", async () => {
    const input = [
      "# Title",
      "",
      "META: slides",
      "",
      "Intro prose.",
      "",
      "## Step one",
      "",
      "![s](/img/1.webp)",
      "",
      "Body one.",
      "",
      "## Step two",
      "",
      "Body two.",
      "",
    ].join("\n");
    const { blocks } = await emitBlocks(input, ctx());
    expect(blockTypes(blocks)).toEqual(["html", "slideset"]);
    const slideset = blocks[1];
    if (slideset.type !== "slideset") throw new Error("expected slideset");
    expect(slideset.source).toBe("canonical");
    expect(slideset.slides.map((s) => s.title)).toEqual([
      "Step one",
      "Step two",
    ]);
    expect(slideset.slides[0].layout).toBe("image-bottom");
    expect(slideset.slides[1].layout).toBe("text");
  });

  it("does not collect consumed step headings into the TOC", async () => {
    const input = ["META: slides", "## Hidden step", "Body."].join("\n");
    const { headings } = await emitBlocks(input, ctx());
    expect(headings).toEqual([]);
  });
});

describe("emitBlocks edge cases", () => {
  it("merges contiguous prose into a single html block", async () => {
    const input = "Para one.\n\nPara two.\n\n> Quote.\n\n- list item\n";
    const { blocks } = await emitBlocks(input, ctx());
    expect(blockTypes(blocks)).toEqual(["html"]);
    const html = (blocks[0] as { html: string }).html;
    expect(html).toContain("Para one.");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<li>");
  });

  it("renders unknown code languages as plaintext", async () => {
    const input = "```nosuchlang\nfoo bar\n```\n";
    const { blocks } = await emitBlocks(input, ctx());
    const code = blocks[0];
    if (code.type !== "code") throw new Error("expected code block");
    expect(code.lang).toBe("plaintext");
    expect(code.html).toContain("foo bar");
  });

  it("treats youtu.be short links as youtube blocks", async () => {
    const input = "https://youtu.be/dQw4w9WgXcQ\n";
    const { blocks } = await emitBlocks(input, ctx());
    expect(blocks[0]).toEqual({ type: "youtube", videoId: "dQw4w9WgXcQ" });
  });

  it("leaves labeled links to non-pdf targets as prose", async () => {
    const input = "[Watch this](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\n";
    const { blocks } = await emitBlocks(input, ctx());
    expect(blockTypes(blocks)).toEqual(["html"]);
  });

  it("reports underDevelopment=false for normal docs", async () => {
    const { underDevelopment } = await emitBlocks("# T\n\nHello.\n", ctx());
    expect(underDevelopment).toBe(false);
  });
});

describe("renderInlineMarkdown", () => {
  it("renders sanitized html with internal links untouched", async () => {
    const html = await renderInlineMarkdown(
      "See [internal](/en/docs/deploy-app/foo) and **bold**.",
    );
    expect(html).toContain('<a href="/en/docs/deploy-app/foo">');
    expect(html).not.toContain("target=");
    expect(html).toContain("<strong>bold</strong>");
  });
});
