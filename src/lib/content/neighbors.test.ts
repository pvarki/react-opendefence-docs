import { describe, expect, it } from "vitest";
import type { LocaleManifest } from "@shared/content-schema";
import {
  globalPositions,
  readerBreadcrumb,
  readingOrder,
  resolveByUrlId,
  resolvePosition,
  resolveSplat,
  stepSplat,
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

describe("resolvePosition", () => {
  it("returns neighbors in reading order", () => {
    const pos = resolvePosition(manifest, "deploy-app", "c-third");
    expect(pos?.prev?.slug).toBe("b-second");
    expect(pos?.next?.slug).toBe("d-fourth");
    expect(pos?.index).toBe(2);
    expect(pos?.total).toBe(4);
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

describe("globalPositions", () => {
  const positions = globalPositions(manifest);

  it("chains every book into one order", () => {
    expect(positions.map((p) => p.page.slug)).toEqual([
      "a-first",
      "b-second",
      "c-third",
      "d-fourth",
      "tak-intro",
    ]);
  });

  it("links neighbours across books but counts within the book", () => {
    const [last, intro] = positions.slice(3);
    expect(last.next?.slug).toBe("tak-intro");
    expect([last.index, last.total]).toEqual([3, 4]);
    expect(intro.prev?.slug).toBe("d-fourth");
    expect([intro.index, intro.total]).toEqual([0, 1]);
    expect(positions[0].prev).toBeUndefined();
    expect(intro.next).toBeUndefined();
  });
});

describe("stepSplat", () => {
  const [first, , , last, intro] = globalPositions(manifest);

  it("steps to the neighbouring page within a book", () => {
    expect(stepSplat(first, 1)).toBe("deploy-app/b-second");
    expect(stepSplat(last, -1)).toBe("deploy-app/c-third");
  });

  it("lands on the cover going forward into another book", () => {
    expect(stepSplat(last, 1)).toBe("guides/tak-guide");
  });

  it("goes straight to the page going back into another book", () => {
    expect(stepSplat(intro, -1)).toBe("deploy-app/d-fourth");
  });

  it("has nowhere to go at either end of the app", () => {
    expect(stepSplat(first, -1)).toBeUndefined();
    expect(stepSplat(intro, 1)).toBeUndefined();
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
