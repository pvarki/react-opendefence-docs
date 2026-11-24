import { describe, expect, it } from "vitest";
import type { LocaleManifest } from "@shared/content-schema";
import {
  bookPositions,
  nextBook,
  readerBreadcrumb,
  readingOrder,
  resolveByUrlId,
  resolveSplat,
} from "./neighbors";

const page = (slug: string, collection: string, order: number) => ({
  id: `id-${slug}`,
  slug,
  collection,
  title: slug,
  breadcrumb: [slug],
  path: `/content/en/pages/${collection}/${slug}.json`,
  updatedAt: "2026-01-01T00:00:00.000Z",
  order,
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
    page("b-second", "deploy-app", 1),
    page("d-fourth", "deploy-app", 3),
    page("tak-intro", "guides/tak-guide", 0),
  ],
};

describe("readingOrder", () => {
  it("sorts by order", () => {
    expect(readingOrder(manifest, "deploy-app").map((p) => p.slug)).toEqual([
      "a-first",
      "b-second",
      "c-third",
      "d-fourth",
    ]);
  });
});

describe("bookPositions", () => {
  const positions = bookPositions(manifest, "deploy-app");

  it("lists the book's pages in reading order, counted within the book", () => {
    expect(positions.map((p) => [p.page.slug, p.index, p.total])).toEqual([
      ["a-first", 0, 4],
      ["b-second", 1, 4],
      ["c-third", 2, 4],
      ["d-fourth", 3, 4],
    ]);
  });

  it("links each page to its neighbours", () => {
    expect(positions[2].prev?.slug).toBe("b-second");
    expect(positions[2].next?.slug).toBe("d-fourth");
  });

  it("stops at the book's ends, never reaching into another book", () => {
    expect(positions[0].prev).toBeUndefined();
    expect(positions[3].next).toBeUndefined();
    expect(bookPositions(manifest, "guides/tak-guide")[0].prev).toBeUndefined();
  });

  it("is empty for an unknown book", () => {
    expect(bookPositions(manifest, "nope")).toEqual([]);
  });
});

describe("nextBook", () => {
  it("names the book that follows", () => {
    expect(nextBook(manifest, "deploy-app")?.slug).toBe("guides/tak-guide");
  });

  it("has none after the last book", () => {
    expect(nextBook(manifest, "guides/tak-guide")).toBeUndefined();
  });

  it("skips a book with nothing to read", () => {
    const withEmpty: LocaleManifest = {
      ...manifest,
      collections: [
        manifest.collections[0],
        { slug: "empty", label: "Empty", section: "guides", order: 1 },
        { ...manifest.collections[1], order: 2 },
      ],
    };
    expect(nextBook(withEmpty, "deploy-app")?.slug).toBe("guides/tak-guide");
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

describe("readerBreadcrumb", () => {
  const withClients: LocaleManifest = {
    ...manifest,
    collections: [
      {
        ...manifest.collections[0],
        clients: [
          { id: "android-x", platform: "android", label: "Android" },
          {
            id: "tracker-x",
            platform: "android",
            label: "TAK Tracker - Android",
          },
        ],
      },
    ],
  };
  const at = (breadcrumb: string[]) => ({
    ...page("p", "deploy-app", 0),
    title: breadcrumb.at(-1)!,
    breadcrumb,
  });

  it("drops the Platforms wrapper and the client organizer", () => {
    expect(
      readerBreadcrumb(
        withClients,
        at(["Platforms", "Android", "User Guide", "Joining"]),
      ),
    ).toEqual(["User Guide", "Joining"]);
    expect(
      readerBreadcrumb(
        withClients,
        at(["Platforms", "TAK Tracker - Android", "START", "Connect"]),
      ),
    ).toEqual(["START", "Connect"]);
  });

  it("drops a bare platform name even outside the client list", () => {
    expect(
      readerBreadcrumb(manifest, at(["Platforms", "iOS", "Introduction"])),
    ).toEqual(["Introduction"]);
  });

  it("keeps real chapters of platform-agnostic books", () => {
    expect(readerBreadcrumb(manifest, at(["Basic Features", "Rooms"]))).toEqual(
      ["Basic Features", "Rooms"],
    );
  });
});

describe("resolveByUrlId", () => {
  const renamed: LocaleManifest = {
    ...manifest,
    pages: [
      page("takserver-user-groups-PQ4dCV2SYR", "deploy-app", 0),
      page("download-the-app-bJC3Opax4P", "guides/tak-guide", 0),
    ],
  };

  it("finds a renamed page by the urlId at the end of its old slug", () => {
    expect(
      resolveByUrlId(renamed, "deploy-app/takserver-groups-PQ4dCV2SYR")?.slug,
    ).toBe("takserver-user-groups-PQ4dCV2SYR");
  });

  it("finds a page moved to another book", () => {
    expect(
      resolveByUrlId(renamed, "deploy-app/make-sure-you-have-atak-bJC3Opax4P/")
        ?.collection,
    ).toBe("guides/tak-guide");
  });

  it("finds a page by its bare urlId", () => {
    expect(resolveByUrlId(renamed, "deploy-app/PQ4dCV2SYR")?.slug).toBe(
      "takserver-user-groups-PQ4dCV2SYR",
    );
  });

  it("returns undefined for unknown urlIds and slugs without one", () => {
    expect(
      resolveByUrlId(renamed, "deploy-app/takserver-groups-XXXXXXXXXX"),
    ).toBeUndefined();
    expect(resolveByUrlId(renamed, "deploy-app/a-first")).toBeUndefined();
    expect(resolveByUrlId(renamed, "deploy-app")).toBeUndefined();
  });
});
