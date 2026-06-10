import { describe, expect, it } from "vitest";
import type { LocaleManifest } from "@shared/content-schema";
import { readingOrder, resolvePosition, resolveSplat } from "./neighbors";

const page = (
  slug: string,
  collection: string,
  order: number,
  hidden = false,
) => ({
  id: `id-${slug}`,
  slug,
  collection,
  title: slug,
  breadcrumb: [slug],
  path: `/content/en/pages/${collection}/${slug}.json`,
  updatedAt: "2026-01-01T00:00:00.000Z",
  order,
  ...(hidden ? { hidden } : {}),
});

const manifest: LocaleManifest = {
  schemaVersion: 1,
  locale: "en",
  generatedAt: "2026-01-01T00:00:00.000Z",
  collections: [
    {
      slug: "deploy-app",
      label: "Deploy App",
      section: "deploy-app",
      order: 0,
    },
    {
      slug: "guides/tak-guide",
      label: "TAK Guide",
      section: "guides",
      order: 1,
    },
  ],
  pages: [
    page("c-third", "deploy-app", 2),
    page("a-first", "deploy-app", 0),
    page("b-hidden", "deploy-app", 1, true),
    page("d-fourth", "deploy-app", 3),
    page("tak-intro", "guides/tak-guide", 0),
  ],
};

describe("readingOrder", () => {
  it("sorts by order and drops hidden pages", () => {
    expect(readingOrder(manifest, "deploy-app").map((p) => p.slug)).toEqual([
      "a-first",
      "c-third",
      "d-fourth",
    ]);
  });
});

describe("resolvePosition", () => {
  it("returns neighbors skipping hidden pages", () => {
    const pos = resolvePosition(manifest, "deploy-app", "c-third");
    expect(pos?.prev?.slug).toBe("a-first");
    expect(pos?.next?.slug).toBe("d-fourth");
    expect(pos?.index).toBe(1);
    expect(pos?.total).toBe(3);
  });

  it("has no prev at book start and no next at book end", () => {
    expect(
      resolvePosition(manifest, "deploy-app", "a-first")?.prev,
    ).toBeUndefined();
    expect(
      resolvePosition(manifest, "deploy-app", "d-fourth")?.next,
    ).toBeUndefined();
  });

  it("returns undefined for unknown slugs", () => {
    expect(resolvePosition(manifest, "deploy-app", "nope")).toBeUndefined();
  });
});

describe("resolveSplat", () => {
  it("resolves a bare collection slug to a cover", () => {
    expect(resolveSplat(manifest, "deploy-app")).toEqual({
      collection: "deploy-app",
    });
  });

  it("resolves nested collection slugs longest-first", () => {
    expect(resolveSplat(manifest, "guides/tak-guide/tak-intro")).toEqual({
      collection: "guides/tak-guide",
      slug: "tak-intro",
    });
  });

  it("rejects unknown paths and over-deep paths", () => {
    expect(resolveSplat(manifest, "nope/page")).toBeUndefined();
    expect(resolveSplat(manifest, "deploy-app/a/b")).toBeUndefined();
  });

  it("tolerates trailing slashes", () => {
    expect(resolveSplat(manifest, "deploy-app/")).toEqual({
      collection: "deploy-app",
    });
  });
});
