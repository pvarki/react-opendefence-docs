// @vitest-environment node
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanLabel,
  extractSlugFromUrl,
  formatDuration,
  pluralize,
  slugify,
  writeJsonFile,
} from "./utils";

describe("extractSlugFromUrl", () => {
  it("keeps Outline base62 shortid suffixes", () => {
    expect(extractSlugFromUrl("/doc/first-login-qwmPnmJsrF")).toBe(
      "first-login-qwmPnmJsrF",
    );
  });

  it("strips legacy all-hex UUID suffixes (8+ hex chars)", () => {
    expect(extractSlugFromUrl("/doc/my-page-9f8e7d6c")).toBe("my-page");
    expect(
      extractSlugFromUrl("/doc/my-page-9f8e7d6c5b4a39281706f5e4d3c2b1a0"),
    ).toBe("my-page");
  });

  it("falls back to the last path segment without /doc/", () => {
    expect(extractSlugFromUrl("/deploy-app/some-page")).toBe("some-page");
    expect(extractSlugFromUrl("some-page")).toBe("some-page");
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
  });

  it("strips emojis before slugging", () => {
    expect(slugify("🚀 Launch  Plan")).toBe("launch-plan");
  });
});

describe("cleanLabel", () => {
  it("removes brackets, emojis and trailing parentheticals", () => {
    expect(cleanLabel("[📱 Android (beta)]")).toBe("Android");
  });

  it("removes #tag: markers", () => {
    expect(cleanLabel("TAK ATAK #tag:android")).toBe("TAK ATAK");
  });

  it("keeps plain labels intact", () => {
    expect(cleanLabel("First Login")).toBe("First Login");
  });
});

describe("formatDuration", () => {
  it("formats ms, seconds and minutes", () => {
    expect(formatDuration(500)).toBe("500ms");
    expect(formatDuration(1500)).toBe("1.50s");
    expect(formatDuration(65_000)).toBe("1m 5.00s");
  });
});

describe("pluralize", () => {
  it("pluralizes based on count", () => {
    expect(pluralize(1, "doc")).toBe("1 doc");
    expect(pluralize(2, "doc")).toBe("2 docs");
  });
});

describe("writeJsonFile", () => {
  let tmp: string;

  beforeAll(async () => {
    tmp = await mkdtemp("/tmp/utils-test-");
  });

  afterAll(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("writes 2-space indented JSON with a trailing newline", async () => {
    const file = path.join(tmp, "nested", "dir", "out.json");
    await writeJsonFile(file, { a: 1, b: ["x"] });
    const content = await readFile(file, "utf-8");
    expect(content).toBe(`{\n  "a": 1,\n  "b": [\n    "x"\n  ]\n}\n`);
  });
});
