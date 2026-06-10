import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  parseSyncArgs,
  collectionMatchesFilter,
  shouldSyncDoc,
  buildBookManifestPages,
  buildLocaleManifest,
  buildTranslationsFile,
  buildSlugRouteMap,
  staleSlugs,
  runWithConcurrency,
  writeJson,
  type BookEntryInput,
} from "./sync-helpers";
import type { BookPageRef } from "./sidebar-generator";
import type { LocaleManifest, ManifestPage } from "../../shared/content-schema";
import type { CollectionConfig } from "../../config/collections";

const DEPLOY: CollectionConfig = {
  collectionId: "00000000-0000-4000-8000-00000000aaaa",
  label: "Deploy App",
  slug: "deploy-app",
  section: "deploy-app",
  description: "",
};
const TAK: CollectionConfig = {
  collectionId: "00000000-0000-4000-8000-00000000bbbb",
  label: "TAK Guide",
  slug: "guides/tak-guide",
  section: "guides",
  description: "",
};

function ref(slug: string, title = slug): BookPageRef {
  return { docId: `id-${slug}`, slug, title, breadcrumb: [title] };
}

function manifestPage(
  over: Partial<ManifestPage> & Pick<ManifestPage, "id" | "slug">,
): ManifestPage {
  return {
    collection: "deploy-app",
    title: over.slug,
    breadcrumb: [over.slug],
    path: `/content/en/pages/deploy-app/${over.slug}.json`,
    updatedAt: "2026-01-01T00:00:00.000Z",
    order: 0,
    ...over,
  } as ManifestPage;
}

describe("parseSyncArgs", () => {
  it("parses flags and both --collection forms", () => {
    expect(parseSyncArgs(["--force", "--collection=guides"], {})).toMatchObject(
      {
        force: true,
        collection: "guides",
        ci: false,
      },
    );
    expect(parseSyncArgs(["--collection", "tak", "-v"], {})).toMatchObject({
      collection: "tak",
      verbose: true,
    });
  });

  it("auto-detects CI from the environment", () => {
    expect(parseSyncArgs([], { CI: "true" }).ci).toBe(true);
    expect(parseSyncArgs([], { CI: "1" }).ci).toBe(true);
    expect(parseSyncArgs(["--ci"], {}).ci).toBe(true);
    expect(parseSyncArgs([], {}).ci).toBe(false);
  });
});

describe("collectionMatchesFilter", () => {
  it("matches exact slug, prefix, substring and label", () => {
    expect(collectionMatchesFilter(DEPLOY, "deploy-app")).toBe(true);
    expect(collectionMatchesFilter(TAK, "guides")).toBe(true);
    expect(collectionMatchesFilter(TAK, "tak")).toBe(true);
    expect(collectionMatchesFilter(TAK, "TAK Guide")).toBe(true);
    expect(collectionMatchesFilter(DEPLOY, "guides")).toBe(false);
  });
});

describe("shouldSyncDoc (incremental check)", () => {
  const t1 = "2026-01-01T00:00:00.000Z";
  const t2 = "2026-02-01T00:00:00.000Z";

  it("forces re-download with --force", () => {
    expect(shouldSyncDoc(t1, t1, true)).toBe(true);
  });
  it("downloads when there is no local state", () => {
    expect(shouldSyncDoc(t1, undefined, false)).toBe(true);
  });
  it("skips when timestamps match", () => {
    expect(shouldSyncDoc(t1, t1, false)).toBe(false);
  });
  it("re-downloads on any drift, including remote rollback", () => {
    expect(shouldSyncDoc(t2, t1, false)).toBe(true);
    expect(shouldSyncDoc(t1, t2, false)).toBe(true);
  });
});

describe("buildBookManifestPages", () => {
  it("assembles entries in reading order with statuses applied", () => {
    const previous = manifestPage({
      id: "id-b",
      slug: "b",
      hidden: true,
      updatedAt: "old",
      order: 7,
    });
    const failedPrev = manifestPage({ id: "id-c", slug: "c", order: 9 });

    const inputs: BookEntryInput[] = [
      {
        ref: ref("a"),
        updatedAt: "t-a",
        status: "processed",
        underDevelopment: true,
      },
      { ref: ref("b"), updatedAt: "t-b", status: "skipped", previous },
      {
        ref: ref("c"),
        updatedAt: "t-c",
        status: "failed",
        previous: failedPrev,
      },
      { ref: ref("d"), updatedAt: "t-d", status: "failed" }, // no previous -> dropped
    ];

    const pages = buildBookManifestPages("en", "deploy-app", inputs);
    expect(pages.map((p) => p.slug)).toEqual(["a", "b", "c"]);
    expect(pages.map((p) => p.order)).toEqual([0, 1, 2]);

    // processed: hidden from emit result, fresh updatedAt
    expect(pages[0]).toMatchObject({
      id: "id-a",
      hidden: true,
      updatedAt: "t-a",
      path: "/content/en/pages/deploy-app/a.json",
    });
    // skipped: hidden carried from previous entry, fresh updatedAt
    expect(pages[1]).toMatchObject({ hidden: true, updatedAt: "t-b" });
    // failed: previous entry preserved (retried next run), reordered
    expect(pages[2]).toMatchObject({
      id: "id-c",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("carries the platform tag", () => {
    const pages = buildBookManifestPages("en", "deploy-app", [
      {
        ref: { ...ref("a"), platform: "android" },
        updatedAt: "t",
        status: "processed",
      },
    ]);
    expect(pages[0].platform).toBe("android");
  });
});

describe("buildLocaleManifest", () => {
  const previous: LocaleManifest = {
    schemaVersion: 1,
    locale: "en",
    generatedAt: "then",
    collections: [],
    pages: [
      manifestPage({ id: "1", slug: "old-deploy", collection: "deploy-app" }),
      manifestPage({
        id: "2",
        slug: "old-tak",
        collection: "guides/tak-guide",
      }),
    ],
  };

  it("uses synced entries and carries over non-synced collections", () => {
    const synced = new Map([
      ["deploy-app", [manifestPage({ id: "3", slug: "new-deploy" })]],
    ]);
    const manifest = buildLocaleManifest({
      locale: "en",
      collections: [DEPLOY, TAK],
      syncedPages: synced,
      previous,
      generatedAt: "now",
    });

    expect(manifest.pages.map((p) => p.slug)).toEqual([
      "new-deploy",
      "old-tak",
    ]);
    expect(manifest.collections.map((c) => c.slug)).toEqual([
      "deploy-app",
      "guides/tak-guide",
    ]);
    expect(manifest.collections.map((c) => c.order)).toEqual([0, 1]);
  });

  it("drops a synced collection's previous pages when it produced none", () => {
    const synced = new Map([["deploy-app", [] as ManifestPage[]]]);
    const manifest = buildLocaleManifest({
      locale: "en",
      collections: [DEPLOY, TAK],
      syncedPages: synced,
      previous,
      generatedAt: "now",
    });
    expect(manifest.pages.map((p) => p.slug)).toEqual(["old-tak"]);
    // deploy-app has no pages anymore -> not listed
    expect(manifest.collections.map((c) => c.slug)).toEqual([
      "guides/tak-guide",
    ]);
  });
});

describe("buildTranslationsFile", () => {
  const slugRoutes = new Map([
    ["sivu-Fi1234567", "/fi/deploy-app/sivu-Fi1234567"],
    ["page-En1234567", "/en/deploy-app/page-En1234567"],
  ]);

  it("enriches bare slugs into route paths and drops unresolvable targets", () => {
    const out = buildTranslationsFile({
      newLinks: new Map([
        ["page-En1234567", { fi: "sivu-Fi1234567", sv: "missing-Sv1234567" }],
      ]),
      slugRoutes,
      validSlugs: new Set(["page-En1234567"]),
      processedSlugs: new Set(["page-En1234567"]),
      previous: undefined,
    });
    expect(out).toEqual({
      "page-En1234567": { fi: "/fi/deploy-app/sivu-Fi1234567" },
    });
  });

  it("carries previous entries unless reprocessed or gone from the manifest", () => {
    const previous = {
      "kept-Aa1234567": { fi: "/fi/deploy-app/x" },
      "reprocessed-Bb1234567": { fi: "/fi/deploy-app/stale" },
      "removed-Cc1234567": { fi: "/fi/deploy-app/y" },
    };
    const out = buildTranslationsFile({
      newLinks: new Map(), // reprocessed page no longer declares translations
      slugRoutes,
      validSlugs: new Set(["kept-Aa1234567", "reprocessed-Bb1234567"]),
      processedSlugs: new Set(["reprocessed-Bb1234567"]),
      previous,
    });
    expect(out).toEqual({ "kept-Aa1234567": { fi: "/fi/deploy-app/x" } });
  });
});

describe("buildSlugRouteMap / staleSlugs", () => {
  it("maps slugs to locale+collection routes", () => {
    const manifest: LocaleManifest = {
      schemaVersion: 1,
      locale: "fi",
      generatedAt: "now",
      collections: [],
      pages: [
        manifestPage({
          id: "1",
          slug: "sivu-Fi1234567",
          collection: "guides/tak-guide",
        }),
      ],
    };
    expect(buildSlugRouteMap([manifest]).get("sivu-Fi1234567")).toBe(
      "/fi/guides/tak-guide/sivu-Fi1234567",
    );
  });

  it("identifies files to delete", () => {
    expect(staleSlugs(["a", "b", "c"], new Set(["b"]))).toEqual(["a", "c"]);
  });
});

describe("runWithConcurrency", () => {
  it("returns settled results in input order", async () => {
    const tasks = [1, 2, 3, 4].map((n) => async () => {
      if (n === 3) throw new Error("boom");
      return n * 10;
    });
    const results = await runWithConcurrency(tasks, 2);
    expect(results.map((r) => r.status)).toEqual([
      "fulfilled",
      "fulfilled",
      "rejected",
      "fulfilled",
    ]);
    expect(results[3]).toMatchObject({ value: 40 });
  });
});

describe("writeJson", () => {
  it("writes 2-space indented JSON with a trailing LF", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sync-helpers-"));
    const file = path.join(dir, "nested", "out.json");
    await writeJson(file, { a: 1 });
    const content = await fs.readFile(file, "utf-8");
    expect(content).toBe(`{\n  "a": 1\n}\n`);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
