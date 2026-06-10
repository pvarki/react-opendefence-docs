import { describe, expect, it } from "vitest";
import { extractLegacySlidesets } from "./legacy";

/** Build a slide code fence. */
const fence = (body: string, lang = "markdown"): string =>
  "```" + lang + "\n" + body + "\n```";

const TWO_SLIDE_BODY = [
  "# Slide 1",
  "- point one",
  "[pic1]",
  "---",
  "# Slide 2",
  "[layout: image-left]",
  "- point two",
  "[pic2]",
].join("\n");

/** Doc with the standard layout: fence, then a Pictures section. */
const doc = (picturesSection: string, body = TWO_SLIDE_BODY): string =>
  [
    "Intro prose.",
    "",
    fence(body),
    "",
    "## Pictures:",
    "",
    picturesSection,
    "",
  ].join("\n");

describe("Pictures-list formats A-H", () => {
  it("format A: inline bullet '* pic1![](/path)'", () => {
    const input = doc(
      ['* pic1![](/img/a1.webp " =100x200")', "* pic2![](/img/a2.webp)"].join(
        "\n",
      ),
    );
    const { markdown, slidesets } = extractLegacySlidesets(input);
    const set = slidesets.get("legacy-0");
    expect(set?.slides[0].imageRefs).toEqual(["/img/a1.webp"]);
    expect(set?.slides[1].imageRefs).toEqual(["/img/a2.webp"]);
    expect(markdown).toContain("%%SLIDESET:legacy-0%%");
    expect(markdown).not.toContain("pic1![](");
    expect(markdown).not.toContain("## Pictures:");
    expect(markdown).toContain("Intro prose.");
  });

  it("format B: key and image on separate lines under a bullet", () => {
    const input = doc(["* pic1", "", "  ![](/img/b1.webp)"].join("\n"));
    const { markdown, slidesets } = extractLegacySlidesets(input);
    expect(slidesets.get("legacy-0")?.slides[0].imageRefs).toEqual([
      "/img/b1.webp",
    ]);
    expect(markdown).not.toContain("/img/b1.webp");
  });

  it("format C: bare key without any bullet", () => {
    const input = doc(["pic1", "![](/img/c1.webp)"].join("\n"));
    const { slidesets } = extractLegacySlidesets(input);
    expect(slidesets.get("legacy-0")?.slides[0].imageRefs).toEqual([
      "/img/c1.webp",
    ]);
  });

  it("format D: reverse format — image shares a line with the NEXT key", () => {
    const body = [
      "# S1",
      "[pic1]",
      "---",
      "# S2",
      "[pic2]",
      "---",
      "# S3",
      "[pic3]",
    ].join("\n");
    const input = doc(
      [
        "pic1",
        "![](/img/d1.webp)pic2",
        "![](/img/d2.webp)pic3",
        "![](/img/d3.webp)",
      ].join("\n"),
      body,
    );
    const { slidesets } = extractLegacySlidesets(input);
    const slides = slidesets.get("legacy-0")?.slides ?? [];
    expect(slides[0].imageRefs).toEqual(["/img/d1.webp"]);
    expect(slides[1].imageRefs).toEqual(["/img/d2.webp"]);
    expect(slides[2].imageRefs).toEqual(["/img/d3.webp"]);
  });

  it("format E: all key+image pairs concatenated on a single line", () => {
    const body = ["# S1", "[pic1]", "---", "# S2", "[pic2]"].join("\n");
    const input = doc("pic1 ![](/img/e1.webp)pic2 ![](/img/e2.webp)", body);
    const { markdown, slidesets } = extractLegacySlidesets(input);
    const slides = slidesets.get("legacy-0")?.slides ?? [];
    expect(slides[0].imageRefs).toEqual(["/img/e1.webp"]);
    expect(slides[1].imageRefs).toEqual(["/img/e2.webp"]);
    expect(markdown).not.toContain("/img/e1.webp");
  });

  it("format F: key and image on the same line separated by spaces", () => {
    const input = doc("pic1  ![](/img/f1.webp)");
    const { slidesets } = extractLegacySlidesets(input);
    expect(slidesets.get("legacy-0")?.slides[0].imageRefs).toEqual([
      "/img/f1.webp",
    ]);
  });

  it("format G: nested double-bullet (fi/sv exports)", () => {
    const input = doc(["* * pic1", "    ![](/img/g1.webp)"].join("\n"));
    const { slidesets } = extractLegacySlidesets(input);
    expect(slidesets.get("legacy-0")?.slides[0].imageRefs).toEqual([
      "/img/g1.webp",
    ]);
  });

  it("format H: spaced key 'pic 8' and spaced slide ref '[pic 8]'", () => {
    const body = ["# S1", "[pic 8]"].join("\n") + "\n---\n# S2";
    const input = doc(["pic 8", "![](/img/h8.webp)"].join("\n"), body);
    const { slidesets } = extractLegacySlidesets(input);
    expect(slidesets.get("legacy-0")?.slides[0].imageRefs).toEqual([
      "/img/h8.webp",
    ]);
  });

  it("first definition of a key wins", () => {
    const input = doc(
      ["* pic1![](/img/first.webp)", "* pic1![](/img/second.webp)"].join("\n"),
    );
    const { slidesets } = extractLegacySlidesets(input);
    expect(slidesets.get("legacy-0")?.slides[0].imageRefs).toEqual([
      "/img/first.webp",
    ]);
  });
});

describe("slide parsing", () => {
  it("extracts title, body and default layouts", () => {
    const input = doc("* pic1![](/img/x.webp)");
    const { slidesets } = extractLegacySlidesets(input);
    const slides = slidesets.get("legacy-0")?.slides ?? [];
    expect(slides[0]).toMatchObject({
      title: "Slide 1",
      layout: "image-bottom", // image present, no explicit layout
      bodyMarkdown: "- point one",
    });
    expect(slides[1].layout).toBe("image-left"); // explicit layout kept
  });

  it("defaults to text layout when a slide has no image", () => {
    const body = ["# Only text", "- a point", "---", "# Another"].join("\n");
    const input = ["x", "", fence(body), ""].join("\n");
    const { slidesets } = extractLegacySlidesets(input);
    expect(slidesets.get("legacy-0")?.slides[0].layout).toBe("text");
  });

  it("normalizes deprecated [layout: split] to image-right", () => {
    const body = ["# S1", "[layout: split]", "[pic1]", "---", "# S2"].join(
      "\n",
    );
    const input = doc("* pic1![](/img/s.webp)", body);
    const { slidesets } = extractLegacySlidesets(input);
    expect(slidesets.get("legacy-0")?.slides[0].layout).toBe("image-right");
  });

  it("falls back to defaults for unknown layout values", () => {
    const body = ["# S1", "[layout: bogus]", "[pic1]", "---", "# S2"].join(
      "\n",
    );
    const input = doc("* pic1![](/img/s.webp)", body);
    const { slidesets } = extractLegacySlidesets(input);
    expect(slidesets.get("legacy-0")?.slides[0].layout).toBe("image-bottom");
  });

  it("drops inline picture definitions and extra headings from slide bodies", () => {
    const body =
      [
        "# Title",
        "- keep me",
        "* pic1![](/img/inline.webp)",
        "## stray heading",
      ].join("\n") + "\n---\n# S2";
    const input = ["x", "", fence(body), ""].join("\n");
    const { slidesets } = extractLegacySlidesets(input);
    expect(slidesets.get("legacy-0")?.slides[0].bodyMarkdown).toBe("- keep me");
  });

  it("supports ```reveal fences and multiple fences per document", () => {
    const one = fence("# A\n---\n# B", "reveal");
    const two = fence("# C\n---\n# D");
    const input = ["intro", "", one, "", "middle", "", two, ""].join("\n");
    const { markdown, slidesets } = extractLegacySlidesets(input);
    expect(slidesets.size).toBe(2);
    expect(markdown).toContain("%%SLIDESET:legacy-0%%");
    expect(markdown).toContain("%%SLIDESET:legacy-1%%");
    expect(markdown).toContain("middle");
  });
});

describe("non-slide content safety", () => {
  it("does nothing without an explicit markdown/reveal fence (gate)", () => {
    const input = [
      "text",
      "",
      "```",
      "---",
      "not slides",
      "---",
      "```",
      "",
    ].join("\n");
    const { markdown, slidesets } = extractLegacySlidesets(input);
    expect(slidesets.size).toBe(0);
    expect(markdown).toBe(input);
  });

  it("leaves other-language fences untouched", () => {
    const bash = fence('echo "---"\n---\nls', "bash");
    const input = ["a", "", bash, "", fence("# S1\n---\n# S2"), ""].join("\n");
    const { markdown, slidesets } = extractLegacySlidesets(input);
    expect(slidesets.size).toBe(1);
    expect(markdown).toContain('echo "---"');
    expect(markdown).toContain("```bash");
  });

  it("leaves markdown fences without --- rules untouched", () => {
    const plain = fence("just an example\nno rules here");
    const input = ["a", "", plain, "", fence("# S1\n---\n# S2"), ""].join("\n");
    const { markdown, slidesets } = extractLegacySlidesets(input);
    expect(slidesets.size).toBe(1);
    expect(markdown).toContain("just an example");
  });

  it("does not consume prose images that are not part of a Pictures list", () => {
    const input = [
      "Intro.",
      "",
      fence("# S1\n---\n# S2"),
      "",
      "A paragraph.",
      "",
      "![standalone](/img/keep.webp)",
      "",
    ].join("\n");
    const { markdown } = extractLegacySlidesets(input);
    expect(markdown).toContain("![standalone](/img/keep.webp)");
  });
});
