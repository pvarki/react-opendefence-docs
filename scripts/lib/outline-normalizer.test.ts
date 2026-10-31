import { describe, expect, it } from "vitest";
import {
  extractTranslationLinks,
  linkedDocKeys,
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

  it("turns links to hidden pages into plain text and reports them", () => {
    const reported: string[] = [];
    const input =
      "See [Overview](/doc/overview-Hh11111111) and " +
      "[VLC](https://pvarki.getoutline.com/doc/vlc-player-Hh22222222#open).\n";
    const out = normalizeOutlineMarkdown(input, {
      ...ctx(),
      hiddenDocKeys: new Set(["overview-Hh11111111", "vlc-player-Hh22222222"]),
      onHiddenLink: (text, key) => reported.push(`${text} -> ${key}`),
    });
    expect(out).toBe("See Overview and VLC.\n");
    expect(reported).toEqual([
      "Overview -> overview-Hh11111111",
      "VLC -> vlc-player-Hh22222222",
    ]);
  });

  it("does not report hidden links in the Translations list", () => {
    const reported: string[] = [];
    const input =
      "* Translations:\n  * en: [en](/doc/fighter-Hh33333333)\n\n" +
      "Read [Fighter](/doc/fighter-Hh33333333).\n";
    const out = normalizeOutlineMarkdown(input, {
      ...ctx(),
      hiddenDocKeys: new Set(["fighter-Hh33333333"]),
      onHiddenLink: (text) => reported.push(text),
    });
    expect(out).toContain("* en: en\n");
    expect(reported).toEqual(["Fighter"]);
  });

  it("drops indented lone-backslash lines inside lists", () => {
    const input = "- Item one\n  \\\n- Item two\n";
    expect(normalizeOutlineMarkdown(input, ctx())).toBe(
      "- Item one\n\n- Item two\n",
    );
  });

  it("turns literal \\n soft breaks into hard breaks outside code", () => {
    const input = String.raw`Types:\n• Map Items\n\n• Files\n` + "\n";
    expect(normalizeOutlineMarkdown(input, ctx())).toBe(
      "Types:\\\n• Map Items\\\n• Files\n",
    );
  });

  it("keeps text after a soft break from starting a new block", () => {
    const input =
      String.raw`Note:\n- one\n# two\n1. three\n---\n**bold** and ` +
      "`code`" +
      String.raw`\n> four` +
      "\n";
    expect(normalizeOutlineMarkdown(input, ctx())).toBe(
      [
        "Note:\\",
        "\\- one\\",
        "\\# two\\",
        "1\\. three\\",
        "\\---\\",
        "**bold** and `code`\\",
        "\\> four",
        "",
      ].join("\n"),
    );
  });

  it("breaks next to inline code and joins heading lines with a space", () => {
    const input =
      String.raw`On:\n` +
      "`https://a/`" +
      String.raw`\n` +
      "`https://b/`\n" +
      String.raw`### Tools:\nNone\n` +
      "\n";
    expect(normalizeOutlineMarkdown(input, ctx())).toBe(
      "On:\\\n`https://a/`\\\n`https://b/`\n### Tools: None\n",
    );
  });

  it("keeps literal \\n in code and escaped backslashes", () => {
    const input = [
      "```mermaid",
      String.raw`A["core\nrmapi"]`,
      "```",
      "",
      "Run `printf 'a\\n'` or C:\\\\new",
      "",
    ].join("\n");
    expect(normalizeOutlineMarkdown(input, ctx())).toBe(input);
  });

  it("keeps trailing-space hard breaks from the CommonMark export", () => {
    // Outline's API export writes Shift+Enter as two trailing spaces.
    const input = [
      "Types:  ",
      "• Map Items   ",
      "• Files",
      "",
      "- Item  ",
      "  more of the item",
      "",
      "> Quote  ",
      "> more",
      "",
    ].join("\n");
    expect(normalizeOutlineMarkdown(input, ctx())).toBe(
      [
        "Types:  ",
        "• Map Items  ",
        "• Files",
        "",
        "- Item  ",
        "  more of the item",
        "",
        "> Quote  ",
        "> more",
        "",
      ].join("\n"),
    );
  });

  it("strips trailing spaces where CommonMark has no hard break", () => {
    const input = [
      "End of a paragraph  ",
      "",
      "- one  ",
      "- two  ",
      "  - nested",
      "Before a heading  ",
      "## Heading",
      "| a | b |  ",
      "| - | - |",
      "```",
      "code  ",
      "more",
      "```",
      "",
    ].join("\n");
    expect(normalizeOutlineMarkdown(input, ctx())).toBe(
      [
        "End of a paragraph",
        "",
        "- one",
        "- two",
        "  - nested",
        "Before a heading",
        "## Heading",
        "| a | b |",
        "| - | - |",
        "```",
        "code",
        "more",
        "```",
        "",
      ].join("\n"),
    );
  });

  it("joins a trailing-space break in a heading with a space", () => {
    const input = "## Tools:  \nNone  \nat all\n\nText\n";
    expect(normalizeOutlineMarkdown(input, ctx())).toBe(
      "## Tools: None at all\n\nText\n",
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

describe("linkedDocKeys", () => {
  it("collects the slug or id of each internal link once", () => {
    const input = [
      "See [setup](/doc/setup-Ab12Cd34Ef#step-2) and",
      "[setup again](https://pvarki.getoutline.com/doc/setup-Ab12Cd34Ef).",
      "[By id](/doc/0f8e6a52-3c1b-4d2e-9a7f-5b6c7d8e9f01)",
      "Not a link: /doc/bare-Zz99Yy88Xx",
    ].join("\n");
    expect([...linkedDocKeys(input)]).toEqual([
      "setup-Ab12Cd34Ef",
      "0f8e6a52-3c1b-4d2e-9a7f-5b6c7d8e9f01",
    ]);
  });
});
