import { describe, expect, it } from "vitest";
import type { LocaleManifest } from "@shared/content-schema";
import {
  readerBreadcrumb,
  readingOrder,
  resolvePosition,
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
