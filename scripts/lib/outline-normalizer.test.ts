import { describe, expect, it } from "vitest";
import {
  extractTranslationLinks,
  normalizeOutlineMarkdown,
  stripEmojis,
  type NormalizeContext,
} from "./outline-normalizer";

const ctx = (routes: Record<string, string> = {}): NormalizeContext => ({
  locale: "en",
  collectionSlug: "deploy-app",
  slugToRoute: (slug) => routes[slug],
});

describe("stripEmojis", () => {
  it("removes emojis and collapses whitespace", () => {
    expect(stripEmojis("🚀 Launch  the 🎉 app")).toBe("Launch the app");
  });

  it("leaves plain text untouched", () => {
    expect(stripEmojis("Första inloggning")).toBe("Första inloggning");
  });
});

describe("normalizeOutlineMarkdown", () => {
  it("unescapes Outline-escaped characters", () => {
    const input = "Some \\[bracketed\\] text with \\*stars\\* and \\`code\\`\n";
    expect(normalizeOutlineMarkdown(input, ctx())).toBe(
      "Some [bracketed] text with *stars* and `code`\n",
    );
  });

  it("unwraps __ around image paths", () => {
    const input = "![alt](__/uploads/img.png__)\n";
    expect(normalizeOutlineMarkdown(input, ctx())).toContain(
      "![alt](/uploads/img.png)",
    );
  });

  it("converts raw <url> links to [url](url)", () => {
    const input = "Visit <https://example.com/page> now\n";
    expect(normalizeOutlineMarkdown(input, ctx())).toContain(
      "[https://example.com/page](https://example.com/page)",
    );
  });

  it("removes empty image tags", () => {
    expect(normalizeOutlineMarkdown("before ![]( ) after\n", ctx())).toBe(
      "before  after\n",
    );
  });

  it("strips emojis from headings only", () => {
    const input = "## 🚀 Launch\n\nBody keeps 🚀 emoji\n";
    const out = normalizeOutlineMarkdown(input, ctx());
    expect(out).toContain("## Launch");
    expect(out).toContain("Body keeps 🚀 emoji");
  });

  it("strips leading YAML frontmatter", () => {
    const input = "---\ntitle: x\n---\n\n# Hello\n";
    expect(normalizeOutlineMarkdown(input, ctx())).toBe("# Hello\n");
  });

  it("rewrites resolvable /doc/ links and keeps unresolvable ones", () => {
    const routes = {
      "first-login-qwmPnmJsrF": "/en/docs/deploy-app/first-login-qwmPnmJsrF",
    };
    const input =
      "[Login](/doc/first-login-qwmPnmJsrF) and [Other](/doc/unknown-abc123)\n";
    const out = normalizeOutlineMarkdown(input, ctx(routes));
    expect(out).toContain(
      "[Login](/en/docs/deploy-app/first-login-qwmPnmJsrF)",
    );
    expect(out).toContain("[Other](/doc/unknown-abc123)");
  });

  it("rewrites absolute Outline /doc/ links and preserves anchors", () => {
    const routes = { "guide-xY12": "/en/docs/guides/tak-guide/guide-xY12" };
    const input =
      "[Guide](https://pvarki.getoutline.com/doc/guide-xY12#setup)\n";
    expect(normalizeOutlineMarkdown(input, ctx(routes))).toContain(
      "[Guide](/en/docs/guides/tak-guide/guide-xY12#setup)",
    );
  });

  it("collapses 3+ blank lines and ends with a single newline", () => {
    const out = normalizeOutlineMarkdown("a\n\n\n\nb\n\n\n", ctx());
    expect(out).toBe("a\n\nb\n");
  });
});

describe("extractTranslationLinks", () => {
  it("extracts bare outline slugs per locale", () => {
    const input = [
      "# Title",
      "",
      "* Translations:",
      "  * en: [What is MTX](/doc/what-is-mtx-dfU8aHguP1)",
      "  * fi: [Mikä on MTX](/doc/mika-on-mtx-Ab12Cd34Ef)",
      "  * sv: [Vad är MTX](/doc/vad-ar-mtx-Gh56Ij78Kl)",
      "",
    ].join("\n");
    expect(extractTranslationLinks(input)).toEqual({
      en: "what-is-mtx-dfU8aHguP1",
      fi: "mika-on-mtx-Ab12Cd34Ef",
      sv: "vad-ar-mtx-Gh56Ij78Kl",
    });
  });

  it("tolerates rewritten route paths and absolute outline URLs", () => {
    const input = [
      "* Translations:",
      "  * en: [X](/en/docs/wikis/mtx/what-is-mtx-dfU8aHguP1)",
      "  * fi: [X](https://pvarki.getoutline.com/doc/mika-on-mtx-Ab12Cd34Ef)",
    ].join("\n");
    expect(extractTranslationLinks(input)).toEqual({
      en: "what-is-mtx-dfU8aHguP1",
      fi: "mika-on-mtx-Ab12Cd34Ef",
    });
  });

  it("maps the legacy 'se' code to sv and skips unknown locales", () => {
    const input = [
      "* Translations:",
      "  * se: [X](/doc/svensk-sida-Ab12Cd34)",
      "  * de: [X](/doc/german-doc-Xy98Zw76)",
    ].join("\n");
    expect(extractTranslationLinks(input)).toEqual({
      sv: "svensk-sida-Ab12Cd34",
    });
  });

  it("returns an empty object when no block exists", () => {
    expect(
      extractTranslationLinks("# Just a doc\n\nNo translations.\n"),
    ).toEqual({});
  });

  it("handles a block at end-of-file without trailing newline", () => {
    const input = "* Translations:\n  * en: [X](/doc/end-of-file-Ab12Cd34)";
    expect(extractTranslationLinks(input)).toEqual({
      en: "end-of-file-Ab12Cd34",
    });
  });
});
