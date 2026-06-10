import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { rebuildLocaleManifest } from "./rebuild-metadata";
import { writeJson } from "./lib/sync-helpers";
import type {
  LocaleManifest,
  PageDoc,
  SidebarConfig,
} from "../shared/content-schema";

const NOW = "2026-01-01T00:00:00.000Z";

function page(over: Partial<PageDoc> & Pick<PageDoc, "id" | "slug">): PageDoc {
  return {
    schemaVersion: 1,
    collection: "deploy-app",
    locale: "en",
    title: over.slug,
    breadcrumb: [over.slug],
    createdAt: NOW,
    updatedAt: NOW,
    headings: [],
    blocks: [],
    ...over,
  } as PageDoc;
}

describe("rebuildLocaleManifest", () => {
  let publicDir: string;
  let manifest: LocaleManifest | undefined;

  beforeAll(async () => {
    publicDir = await fs.mkdtemp(path.join(os.tmpdir(), "rebuild-meta-"));
    const en = path.join(publicDir, "content", "en");
    const pages = path.join(en, "pages", "deploy-app");

    await writeJson(
      path.join(pages, "a-Aa11111111.json"),
      page({ id: "id-a", slug: "a-Aa11111111" }),
    );
    await writeJson(
      path.join(pages, "b-Bb22222222.json"),
      page({ id: "id-b", slug: "b-Bb22222222" }),
    );
    await writeJson(
      path.join(pages, "c-Cc33333333.json"),
      page({ id: "id-c", slug: "c-Cc33333333", underDevelopment: true }),
    );
    // Invalid file is skipped with a warning, not fatal.
    await writeJson(path.join(pages, "junk.json"), { nope: 1 });

    // Sidebar puts b before a (depth-first through the group); c is absent.
    const sidebar: SidebarConfig = {
      schemaVersion: 1,
      label: "Deploy App",
      slug: "deploy-app",
      items: [
        {
          type: "group",
          id: "b-Bb22222222",
          label: "B",
          children: [
            {
              type: "doc",
              id: "b-Bb22222222",
              label: "B",
              slug: "b-Bb22222222",
            },
          ],
        },
        { type: "doc", id: "a-Aa11111111", label: "A", slug: "a-Aa11111111" },
      ],
    };
    await writeJson(path.join(en, "sidebars", "deploy-app.json"), sidebar);

    // Previous manifest provides the fallback order for c and a platform tag for a.
    const previous: LocaleManifest = {
      schemaVersion: 1,
      locale: "en",
      generatedAt: NOW,
      collections: [],
      pages: [
        {
          id: "id-a",
          slug: "a-Aa11111111",
          collection: "deploy-app",
          title: "A",
          breadcrumb: ["A"],
          path: "/content/en/pages/deploy-app/a-Aa11111111.json",
          updatedAt: NOW,
          order: 1,
          platform: "ios",
        },
        {
          id: "id-c",
          slug: "c-Cc33333333",
          collection: "deploy-app",
          title: "C",
          breadcrumb: ["C"],
          path: "/content/en/pages/deploy-app/c-Cc33333333.json",
          updatedAt: NOW,
          order: 5,
        },
      ],
    };
    await writeJson(path.join(en, "manifest.json"), previous);

    manifest = await rebuildLocaleManifest(publicDir, "en");
  });

  afterAll(async () => {
    await fs.rm(publicDir, { recursive: true, force: true });
  });

  it("orders pages by sidebar reading order, falling back to previous order", () => {
    expect(manifest).toBeDefined();
    expect(manifest!.pages.map((p) => p.slug)).toEqual([
      "b-Bb22222222", // sidebar idx 0
      "a-Aa11111111", // sidebar idx 1
      "c-Cc33333333", // not in sidebar -> previous order fallback
    ]);
    expect(manifest!.pages.map((p) => p.order)).toEqual([0, 1, 2]);
  });

  it("derives hidden from underDevelopment and carries platform", () => {
    const c = manifest!.pages.find((p) => p.slug === "c-Cc33333333");
    expect(c?.hidden).toBe(true);
    const a = manifest!.pages.find((p) => p.slug === "a-Aa11111111");
    expect(a?.platform).toBe("ios");
  });

  it("builds collections from config order and page paths", () => {
    expect(manifest!.collections.map((c) => c.slug)).toEqual(["deploy-app"]);
    expect(manifest!.pages[0].path).toBe(
      "/content/en/pages/deploy-app/b-Bb22222222.json",
    );
  });

  it("returns undefined for a locale with no content", async () => {
    expect(await rebuildLocaleManifest(publicDir, "sv")).toBeUndefined();
  });
});
