import { describe, expect, it } from "vitest";
import { extractCanonicalSlideset } from "./canonical";

describe("extractCanonicalSlideset", () => {
  it("returns the doc unchanged when no META marker is present", () => {
    const input = "# Title\n\n## A heading\n\nProse.\n";
    const result = extractCanonicalSlideset(input);
    expect(result.slideset).toBeUndefined();
    expect(result.markdown).toBe(input);
  });

  it("consumes H2 steps and returns the intro without the META line", () => {
    const input = [
      "# Page Title",
      "",
      "META: slides",
      "",
      "Intro prose stays.",
      "",
      "## Step one",
      "",
      '![first](/img/1.webp " =100x200")',
      "",
      "Do the first thing.",
      "",
      "## Step two",
      "",
      "No image here.",
      "",
    ].join("\n");

    const { markdown, slideset } = extractCanonicalSlideset(input);

    expect(markdown).toContain("# Page Title");
    expect(markdown).toContain("Intro prose stays.");
    expect(markdown).not.toContain("META: slides");
    expect(markdown).not.toContain("## Step one");

    expect(slideset?.source).toBe("canonical");
    expect(slideset?.slides).toHaveLength(2);
    expect(slideset?.slides[0]).toEqual({
      title: "Step one",
      layout: "image-bottom",
      bodyMarkdown: "Do the first thing.",
      imageRefs: ["/img/1.webp"],
    });
    expect(slideset?.slides[1]).toEqual({
      title: "Step two",
      layout: "text",
      bodyMarkdown: "No image here.",
      imageRefs: [],
    });
  });

  it("works without any intro before the first H2", () => {
    const input = ["META: slides", "## Only step", "Body."].join("\n");
    const { markdown, slideset } = extractCanonicalSlideset(input);
    expect(markdown.trim()).toBe("");
    expect(slideset?.slides).toHaveLength(1);
    expect(slideset?.slides[0].title).toBe("Only step");
  });

  it("accepts 'META: slideset' and is case-insensitive", () => {
    for (const marker of ["META: slideset", "meta: Slides", "META:slides"]) {
      const input = [marker, "## S", "x"].join("\n");
      expect(extractCanonicalSlideset(input).slideset).toBeDefined();
    }
  });

  it("only treats the marker as canonical before the first H2", () => {
    const input = ["# T", "", "## H2", "", "META: slides", ""].join("\n");
    const result = extractCanonicalSlideset(input);
    expect(result.slideset).toBeUndefined();
    expect(result.markdown).toBe(input);
  });

  it("drops only the marker when there are no H2 steps", () => {
    const input = ["# T", "", "META: slides", "", "Just prose."].join("\n");
    const { markdown, slideset } = extractCanonicalSlideset(input);
    expect(slideset).toBeUndefined();
    expect(markdown).not.toContain("META: slides");
    expect(markdown).toContain("Just prose.");
  });

  it("uses only the FIRST image of a step as the slide image", () => {
    const input = [
      "META: slides",
      "## Step",
      "![a](/img/a.webp)",
      "Text between.",
      "![b](/img/b.webp)",
    ].join("\n");
    const { slideset } = extractCanonicalSlideset(input);
    expect(slideset?.slides[0].imageRefs).toEqual(["/img/a.webp"]);
    expect(slideset?.slides[0].bodyMarkdown).toContain("![b](/img/b.webp)");
  });
});
