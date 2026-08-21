import { describe, expect, it, vi } from "vitest";

import {
  decodeEntities,
  fitFontSize,
  fitRect,
  GEOM,
  htmlToParas,
  parasToTextProps,
} from "./pptx";

describe("decodeEntities", () => {
  it("decodes numeric hex/dec and named entities", () => {
    expect(decodeEntities("A &#x26; B &#38; C")).toBe("A & B & C");
    expect(decodeEntities("&#x3C;tag&gt; &quot;q&quot; &amp;")).toBe(
      '<tag> "q" &',
    );
  });

  it("leaves unknown entities untouched", () => {
    expect(decodeEntities("&bogus; &#xZZ;")).toBe("&bogus; &#xZZ;");
  });
});

describe("htmlToParas", () => {
  it("maps paragraphs and inline styles to runs", () => {
    const paras = htmlToParas(
      "<p>Open <strong>Settings</strong> then <em>tap</em> <code>OK</code></p>",
    );
    expect(paras).toHaveLength(1);
    const runs = paras[0].runs;
    expect(runs[0]).toEqual({ text: "Open " });
    expect(runs[1]).toEqual({ text: "Settings", bold: true });
    expect(runs.at(-1)).toEqual({ text: "OK", mono: true });
    expect(runs.some((r) => r.italic && r.text === "tap")).toBe(true);
    // word separators between inline elements survive
    expect(runs.map((r) => r.text).join("")).toBe("Open Settings then tap OK");
  });

  it("maps flat and nested lists with depth", () => {
    const paras = htmlToParas(
      "<ul>\n<li>one</li>\n<li>two<ul>\n<li>two-a</li>\n</ul>\n</li>\n</ul>",
    );
    expect(
      paras.map((p) => [p.runs.map((r) => r.text).join(""), p.indent]),
    ).toEqual([
      ["one", 1],
      ["two", 1],
      ["two-a", 2],
    ]);
    expect(paras.every((p) => p.bullet === true)).toBe(true);
  });

  it("numbers ordered lists", () => {
    const paras = htmlToParas("<ol>\n<li>first</li>\n<li>second</li>\n</ol>");
    expect(paras).toHaveLength(2);
    expect(paras[0].bullet).toEqual({ type: "number" });
  });

  it("links absolute hrefs, styles Outline-internal ones without linking", () => {
    const paras = htmlToParas(
      '<p><a href="https://example.com/x">ext</a> and <a href="/doc/abc-123">int</a></p>',
    );
    const [ext, , int] = paras[0].runs;
    expect(ext).toEqual({ text: "ext", href: "https://example.com/x" });
    expect(int).toEqual({ text: "int", underline: true });
  });

  it("keeps bullets in loose lists (<li><p>…</p></li>)", () => {
    // Real corpus shape from guides/tak-guide/download-the-app: markdown list
    // items separated by blank lines emit <li>\n<p>text</p>\n</li>.
    const paras = htmlToParas(
      "<ul>\n<li>\n<p>ATAK app asks permissions</p>\n</li>\n<li>\n<p>Allow all</p>\n</li>\n</ul>",
    );
    expect(paras).toHaveLength(2);
    expect(paras.every((p) => p.bullet === true && p.indent === 1)).toBe(true);
    expect(paras[0].runs[0].text).toBe("ATAK app asks permissions");
  });

  it("maps br to a soft break within the paragraph, keeping bullet context", () => {
    const [para] = htmlToParas("<ul>\n<li>line1<br>line2</li>\n</ul>");
    expect(para.bullet).toBe(true);
    expect(para.runs).toEqual([
      { text: "line1" },
      { text: "line2", softBreak: true },
    ]);
    const props = parasToTextProps([para]);
    expect(props[1].options.softBreakBefore).toBe(true);
    expect(props[1].options.breakLine).toBe(true);
  });

  it("turns hr into an empty spacer paragraph", () => {
    const paras = htmlToParas("<p>a</p>\n<hr>\n<p>b</p>");
    expect(paras).toHaveLength(3);
    expect(paras[1].runs).toEqual([{ text: "" }]);
  });

  it("strips unknown tags with a warning, keeping the text", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const paras = htmlToParas("<p><table>kept</table></p>");
    expect(paras[0].runs).toEqual([{ text: "kept" }]);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("decodes entities inside text", () => {
    const paras = htmlToParas("<p>Fish &#x26; Chips</p>");
    expect(paras[0].runs[0].text).toBe("Fish & Chips");
  });
});

describe("parasToTextProps", () => {
  it("puts paragraph options on the first run and breakLine on the last", () => {
    const props = parasToTextProps(
      htmlToParas("<p>a <strong>b</strong></p>\n<ul>\n<li>c</li>\n</ul>"),
    );
    expect(props[0].options.bullet).toBe(false);
    expect(props[0].options.breakLine).toBeUndefined();
    expect(props[1].options.breakLine).toBe(true);
    expect(props[1].options.bold).toBe(true);
    const bullet = props.at(-1)!;
    expect(bullet.options.bullet).toBe(true);
    expect(bullet.options.indentLevel).toBe(0);
    expect(bullet.options.breakLine).toBe(true);
  });

  it("maps nested bullets to indentLevel 1 and mono to Courier New", () => {
    const props = parasToTextProps(
      htmlToParas(
        "<ul>\n<li>a<ul>\n<li><code>x</code></li>\n</ul>\n</li>\n</ul>",
      ),
    );
    const nested = props.at(-1)!;
    expect(nested.options.indentLevel).toBe(1);
    expect(nested.options.fontFace).toBe("Courier New");
  });
});

describe("fitFontSize", () => {
  const bottomBody = GEOM["image-bottom"].body;

  it("keeps the base size for a short caption", () => {
    const paras = htmlToParas("<p>Tap the button.</p>");
    expect(fitFontSize(paras, bottomBody)).toBe(15);
  });

  it("shrinks a long caption so read-only viewers don't overflow the box", () => {
    const long = `<p>${"Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(20)}</p>`;
    const size = fitFontSize(htmlToParas(long), bottomBody);
    expect(size).toBeLessThan(15);
    expect(size).toBeGreaterThanOrEqual(9);
  });
});

describe("fitRect", () => {
  const box = { x: 0.5, y: 1.3, w: 3.4, h: 5.9 };

  it("fits a tall phone screenshot by height, centered horizontally", () => {
    const r = fitRect(2560, 5712, box);
    expect(r.h).toBeCloseTo(5.9, 5);
    expect(r.w).toBeCloseTo((2560 / 5712) * 5.9, 5);
    expect(r.x).toBeCloseTo(box.x + (box.w - r.w) / 2, 5);
    expect(r.y).toBeCloseTo(box.y, 5);
  });

  it("fits a wide desktop screenshot by width in the bottom box", () => {
    const b = GEOM["image-bottom"].image!;
    const r = fitRect(2256, 1009, b);
    // aspect 2.24 vs box aspect 2.97 → height-constrained
    expect(r.h).toBeCloseTo(b.h, 5);
    expect(r.w).toBeCloseTo((2256 / 1009) * b.h, 5);
    expect(r.w).toBeLessThanOrEqual(b.w + 1e-9);
  });

  it("never upscales past native 96dpi size", () => {
    const r = fitRect(96, 96, box); // 1×1 in native
    expect(r.w).toBeCloseTo(1, 5);
    expect(r.h).toBeCloseTo(1, 5);
  });
});
