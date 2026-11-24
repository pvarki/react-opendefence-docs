import { describe, expect, it } from "vitest";
import type { LocaleManifest } from "@shared/content-schema";
import { applySectionStatus } from "./loader";

const book = (slug: string, section: "guides" | "wikis" | "dev") => ({
  slug,
  label: slug,
  section,
  order: 0,
});

const page = (slug: string, collection: string) => ({
  id: slug,
  slug,
  collection,
  title: slug,
  breadcrumb: [slug],
  path: `/content/en/pages/${collection}/${slug}.json`,
  updatedAt: "2026-01-01T00:00:00.000Z",
  order: 0,
});

const manifest: LocaleManifest = {
  schemaVersion: 1,
  locale: "en",
  generatedAt: "2026-01-01T00:00:00.000Z",
  collections: [
    book("guides/tak-guide", "guides"),
    book("wikis/tak", "wikis"),
    book("architecture", "dev"),
  ],
  pages: [
    page("guide-page", "guides/tak-guide"),
    page("wiki-page", "wikis/tak"),
    page("dev-page", "architecture"),
  ],
};

describe("applySectionStatus", () => {
  const seen = applySectionStatus(manifest);

  it("drops the books and pages of hidden sections", () => {
    expect(seen.collections.map((c) => c.slug)).toEqual([
      "guides/tak-guide",
      "wikis/tak",
    ]);
    expect(seen.pages.map((p) => p.slug)).toEqual(["guide-page", "wiki-page"]);
  });

  it("flags books and pages of sections under construction, only those", () => {
    expect(seen.collections.map((c) => !!c.underDevelopment)).toEqual([
      false,
      true,
    ]);
    expect(seen.pages.map((p) => !!p.underDevelopment)).toEqual([false, true]);
  });
});
