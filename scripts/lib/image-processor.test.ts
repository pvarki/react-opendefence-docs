// @vitest-environment node
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isConvertibleImage,
  processDocumentImages,
  updateImageReferences,
  type ProcessedImage,
} from "./image-processor";

async function makePng(width = 3, height = 2): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();
}

function hash16(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

describe("processDocumentImages", () => {
  let tmp: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    tmp = await mkdtemp("/tmp/image-processor-test-");
    process.chdir(tmp);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(tmp, { recursive: true, force: true });
  });

  it("converts PNG to WebP with content-addressed name and dimensions", async () => {
    const png = await makePng(3, 2);
    const result = await processDocumentImages(
      new Map([["attachments/abc-123.png", png]]),
      "fi",
    );

    const processed = result.get("attachments/abc-123.png");
    expect(processed).toBeDefined();
    expect(processed!.src).toBe(
      `/content/images/fi/attachments/${hash16(png)}.webp`,
    );
    expect(processed!.width).toBe(3);
    expect(processed!.height).toBe(2);

    const written = await readFile(
      path.join(
        tmp,
        "public",
        "content",
        "images",
        "fi",
        "attachments",
        `${hash16(png)}.webp`,
      ),
    );
    expect(written.subarray(0, 4).toString("ascii")).toBe("RIFF");
  });

  it("is deterministic: identical bytes produce identical filenames", async () => {
    const png = await makePng();
    const first = await processDocumentImages(
      new Map([["attachments/a.png", png]]),
      "en",
    );
    const second = await processDocumentImages(
      new Map([["attachments/renamed-copy.png", Buffer.from(png)]]),
      "en",
    );
    expect(first.get("attachments/a.png")!.src).toBe(
      second.get("attachments/renamed-copy.png")!.src,
    );
  });

  it("passes existing WebP through byte-identical", async () => {
    const webp = await sharp(await makePng())
      .webp({ quality: 80 })
      .toBuffer();
    const result = await processDocumentImages(
      new Map([["attachments/already.webp", webp]]),
      "en",
    );

    const processed = result.get("attachments/already.webp")!;
    const written = await readFile(
      path.join(tmp, "public", processed.src.replace(/^\//, "")),
    );
    expect(written.equals(webp)).toBe(true);
  });

  it("skips non-image attachments and corrupt images without throwing", async () => {
    const result = await processDocumentImages(
      new Map([
        ["attachments/spec.pdf", Buffer.from("%PDF-1.4")],
        ["attachments/broken.png", Buffer.from("not really a png")],
      ]),
      "en",
    );
    expect(result.size).toBe(0);
  });

  it("returns an empty map for documents without images", async () => {
    const result = await processDocumentImages(new Map(), "en");
    expect(result.size).toBe(0);
  });
});

describe("isConvertibleImage", () => {
  it("matches raster formats only", () => {
    expect(isConvertibleImage("a.png")).toBe(true);
    expect(isConvertibleImage("a.JPG")).toBe(true);
    expect(isConvertibleImage("a.webp")).toBe(false);
    expect(isConvertibleImage("a.svg")).toBe(false);
    expect(isConvertibleImage("a.pdf")).toBe(false);
  });
});

describe("updateImageReferences", () => {
  const entry = "attachments/efdd56d5-aaaa-4bbb-8ccc-929b60df5d2f.png";
  const src = "/content/images/en/attachments/0123456789abcdef.webp";
  const imageMap = new Map<string, ProcessedImage>([
    [entry, { src, width: 3, height: 2 }],
  ]);

  it("rewrites plain markdown image refs", () => {
    const md = `before\n![shot](${entry})\nafter`;
    expect(updateImageReferences(md, imageMap, "en")).toBe(
      `before\n![shot](${src})\nafter`,
    );
  });

  it("rewrites markdown refs with size attributes after the path", () => {
    const md = `![shot](${entry} " =360x640")`;
    expect(updateImageReferences(md, imageMap, "en")).toBe(
      `![shot](${src} " =360x640")`,
    );
  });

  it("rewrites HTML img tags with the exact path", () => {
    const md = `<img src="${entry}" alt="x">`;
    expect(updateImageReferences(md, imageMap, "en")).toBe(
      `<img src="${src}" alt="x">`,
    );
  });

  it("rewrites absolute Outline attachment URLs (markdown + html)", () => {
    const url =
      "https://pvarki.getoutline.com/attachments/efdd56d5-aaaa-4bbb-8ccc-929b60df5d2f.png";
    expect(updateImageReferences(`![x](${url})`, imageMap, "en")).toBe(
      `![x](${src})`,
    );
    expect(
      updateImageReferences(`<img src="${url}" alt="x">`, imageMap, "en"),
    ).toBe(`<img src="${src}" alt="x">`);
  });

  it("rewrites the malformed missing-slash getoutline.comattachments URLs", () => {
    // Real-world Outline export bug: domain and path concatenated.
    const url =
      "https://pvarki.getoutline.comattachments/efdd56d5-aaaa-4bbb-8ccc-929b60df5d2f.png";
    expect(updateImageReferences(`![x](${url})`, imageMap, "en")).toBe(
      `![x](${src})`,
    );
    expect(
      updateImageReferences(`<img src="${url}" alt="x">`, imageMap, "en"),
    ).toBe(`<img src="${src}" alt="x">`);
  });

  it("leaves references to unknown images untouched", () => {
    const md = "![other](attachments/00000000-1111-2222-3333-444444444444.png)";
    expect(updateImageReferences(md, imageMap, "en")).toBe(md);
  });

  it("throws when the map was built for a different locale", () => {
    expect(() => updateImageReferences("x", imageMap, "fi")).toThrow(
      /not processed for locale "fi"/,
    );
  });
});
