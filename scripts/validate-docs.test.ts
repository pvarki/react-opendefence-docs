import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  validateDocs,
  renderReport,
  baseSlug,
  parseRouteHref,
  collectHrefs,
  collectAssetSrcs,
  OUTLINE_DOC_BASE,
  type ValidationIssue,
} from "./validate-docs";
import { writeJson } from "./lib/sync-helpers";
import type {
  PageDoc,
  LocaleManifest,
  ManifestPage,
  Block,
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
    blocks: [{ type: "html", html: "<p>content</p>" }],
    ...over,
  } as PageDoc;
}

function entry(slug: string, locale: string, order: number): ManifestPage {
  return {
    id: `id-${slug}`,
    slug,
    collection: "deploy-app",
    title: slug,
    breadcrumb: [slug],
    path: `/content/${locale}/pages/deploy-app/${slug}.json`,
    updatedAt: NOW,
    order,
  };
}

function manifest(locale: "en" | "fi", pages: ManifestPage[]): LocaleManifest {
  return { schemaVersion: 1, locale, generatedAt: NOW, collections: [], pages };
}

describe("validateDocs", () => {
  let publicDir: string;
  let issues: ValidationIssue[];
  const byCode = (code: string) => issues.filter((i) => i.code === code);

  beforeAll(async () => {
    publicDir = await fs.mkdtemp(path.join(os.tmpdir(), "validate-docs-"));
    const en = path.join(publicDir, "content", "en");
    const fi = path.join(publicDir, "content", "fi");

    // Image assets: ok.webp exists, missing.webp does not.
    const imgDir = path.join(
      publicDir,
      "content",
      "images",
      "en",
      "attachments",
    );
    await fs.mkdir(imgDir, { recursive: true });
    await fs.writeFile(path.join(imgDir, "ok.webp"), "x");

    // en manifest: welcome, two duplicate-base slugs, slides, empty, ghost (no file)
    await writeJson(
      path.join(en, "manifest.json"),
      manifest("en", [
        entry("welcome-Aa11111111", "en", 0),
        entry("dup-Aa12345678", "en", 1),
        entry("dup-Bb87654321", "en", 2),
        entry("slides-Ee11111111", "en", 3),
        entry("empty-Ff11111111", "en", 4),
        entry("ghost-Cc11111111", "en", 5), // missing-page-file
      ]),
    );
    await writeJson(
      path.join(fi, "manifest.json"),
      manifest("fi", [entry("sivu-Bb22222222", "fi", 0)]),
    );

    const pages = path.join(en, "pages", "deploy-app");
    await writeJson(
      path.join(pages, "welcome-Aa11111111.json"),
      page({
        id: "id-welcome",
        slug: "welcome-Aa11111111",
        blocks: [
          {
            type: "html",
            html:
              '<p><a href="/fi/deploy-app/sivu-Bb22222222">ok</a>' +
              '<a href="/en/deploy-app/nope-Zz99999999">broken</a>' +
              '<a href="https://example.com/x">external</a>' +
              '<a href="#anchor">anchor</a>' +
              '<img src="/content/images/en/attachments/missing.webp"></p>',
          },
          {
            type: "image",
            src: "/content/images/en/attachments/ok.webp",
            alt: "ok",
          },
        ] as Block[],
      }),
    );
    await writeJson(
      path.join(pages, "dup-Aa12345678.json"),
      page({ id: "id-dup-a", slug: "dup-Aa12345678" }),
    );
    await writeJson(
      path.join(pages, "dup-Bb87654321.json"),
      page({ id: "id-dup-b", slug: "dup-Bb87654321" }),
    );
    await writeJson(
      path.join(pages, "slides-Ee11111111.json"),
      page({
        id: "id-slides",
        slug: "slides-Ee11111111",
        blocks: [
          {
            type: "slideset",
            source: "legacy",
            slides: [
              { layout: "image-left", html: "<p>step</p>", images: [] },
              { layout: "text", html: "<p>text only is fine</p>", images: [] },
            ],
          },
        ] as Block[],
      }),
    );
    await writeJson(
      path.join(pages, "empty-Ff11111111.json"),
      page({ id: "id-empty", slug: "empty-Ff11111111", blocks: [] }),
    );
    // Orphan: on disk, not in manifest
    await writeJson(
      path.join(pages, "orphan-Dd11111111.json"),
      page({ id: "id-orphan", slug: "orphan-Dd11111111" }),
    );
    // Invalid page JSON
    await writeJson(path.join(pages, "broken-Gg11111111.json"), { foo: true });

    // fi page (links back to a valid en route)
    await writeJson(
      path.join(fi, "pages", "deploy-app", "sivu-Bb22222222.json"),
      page({
        id: "id-sivu",
        slug: "sivu-Bb22222222",
        locale: "fi",
        blocks: [
          {
            type: "html",
            html: '<a href="/en/deploy-app/welcome-Aa11111111">en</a>',
          },
        ] as Block[],
      }),
    );

    issues = await validateDocs(publicDir);
  });

  afterAll(async () => {
    await fs.rm(publicDir, { recursive: true, force: true });
  });

  it("flags broken internal links but accepts resolvable/external/anchor hrefs", () => {
    const broken = byCode("broken-internal-link");
    expect(broken).toHaveLength(1);
    expect(broken[0]).toMatchObject({
      level: "error",
      locale: "en",
      slug: "welcome-Aa11111111",
    });
    expect(broken[0].message).toContain("/en/deploy-app/nope-Zz99999999");
  });

  it("flags missing image files (inline <img> included)", () => {
    const missing = byCode("missing-image");
    expect(missing).toHaveLength(1);
    expect(missing[0].message).toContain("missing.webp");
  });

  it("flags manifest entries without page files", () => {
    expect(byCode("missing-page-file")).toHaveLength(1);
    expect(byCode("missing-page-file")[0].slug).toBe("ghost-Cc11111111");
  });

  it("flags orphaned pages", () => {
    expect(byCode("orphaned-page")).toHaveLength(1);
    expect(byCode("orphaned-page")[0].slug).toBe("orphan-Dd11111111");
  });

  it("flags duplicate base slugs within a collection+locale", () => {
    const dups = byCode("duplicate-base-slug");
    expect(dups).toHaveLength(1);
    expect(dups[0].message).toContain("dup-Aa12345678");
    expect(dups[0].message).toContain("dup-Bb87654321");
  });

  it("flags invalid page JSON", () => {
    expect(byCode("invalid-page")).toHaveLength(1);
    expect(byCode("invalid-page")[0].slug).toBe("broken-Gg11111111");
  });

  it("warns about legacy slidesets and image-layout slides without images", () => {
    expect(byCode("legacy-slideset-format")).toHaveLength(1);
    expect(byCode("legacy-slideset-format")[0].level).toBe("warning");
    const stepMissing = byCode("slideset-step-missing-image");
    expect(stepMissing).toHaveLength(1);
    expect(stepMissing[0].message).toContain("1 slide(s)");
  });

  it("warns about empty docs", () => {
    expect(byCode("empty-doc").map((i) => i.slug)).toEqual([
      "empty-Ff11111111",
    ]);
  });

  it("reports missing locale roots as info", () => {
    const missingRoot = byCode("missing-locale-root");
    expect(missingRoot).toHaveLength(1);
    expect(missingRoot[0]).toMatchObject({
      level: "info",
      locale: "sv",
      collection: "deploy-app",
    });
  });

  it("attaches Outline deep links", () => {
    for (const i of issues.filter((x) => x.slug)) {
      expect(i.outlineUrl).toBe(`${OUTLINE_DOC_BASE}${i.slug}`);
    }
  });
});

describe("helpers", () => {
  it("baseSlug strips shortid suffixes only", () => {
    expect(baseSlug("first-login-qwmPnmJsrF")).toBe("first-login");
    expect(baseSlug("welcome-fixture01")).toBe("welcome");
    // all-lowercase long words are NOT shortids
    expect(baseSlug("deploying-application")).toBe("deploying-application");
    expect(baseSlug("short-ab1")).toBe("short-ab1");
  });

  it("parseRouteHref handles anchors, queries and non-route hrefs", () => {
    expect(parseRouteHref("/en/deploy-app/foo-Aa11111111#h2")).toEqual({
      locale: "en",
      routeKey: "deploy-app/foo-Aa11111111",
    });
    expect(parseRouteHref("/fi/guides/tak-guide/x-Bb22222222?q=1")).toEqual({
      locale: "fi",
      routeKey: "guides/tak-guide/x-Bb22222222",
    });
    expect(parseRouteHref("/content/en/pages/x.json")).toBeUndefined();
    expect(parseRouteHref("https://example.com/en/x")).toBeUndefined();
    expect(parseRouteHref("#anchor")).toBeUndefined();
    expect(parseRouteHref("/de/foo")).toBeUndefined();
  });

  it("collectHrefs/collectAssetSrcs cover html, slides and typed blocks", () => {
    const doc = page({
      id: "x",
      slug: "x-Aa11111111",
      blocks: [
        {
          type: "html",
          html: '<a href="/en/a/b"><img src="/content/i.webp"></a>',
        },
        {
          type: "slideset",
          source: "canonical",
          slides: [
            {
              layout: "image-left",
              html: '<a href="/fi/c/d">x</a>',
              images: [{ src: "/content/images/en/attachments/s.webp" }],
            },
          ],
        },
        { type: "image", src: "/content/img2.webp", alt: "" },
        { type: "pdf", src: "/content/doc.pdf" },
      ] as Block[],
    });
    expect(collectHrefs(doc)).toEqual(["/en/a/b", "/fi/c/d"]);
    expect(collectAssetSrcs(doc)).toEqual([
      "/content/i.webp",
      "/content/images/en/attachments/s.webp",
      "/content/img2.webp",
      "/content/doc.pdf",
    ]);
  });

  it("renderReport produces a summary table and per-collection sections", () => {
    const issues: ValidationIssue[] = [
      {
        level: "error",
        code: "broken-internal-link",
        message: "Link broken",
        locale: "en",
        collection: "deploy-app",
        slug: "a-Aa11111111",
        outlineUrl: `${OUTLINE_DOC_BASE}a-Aa11111111`,
      },
      {
        level: "warning",
        code: "empty-doc",
        message: "No blocks",
        locale: "fi",
        collection: "guides/tak-guide",
        slug: "b-Bb22222222",
        outlineUrl: `${OUTLINE_DOC_BASE}b-Bb22222222`,
      },
    ];
    const report = renderReport(issues);
    expect(report).toContain("| Level | Code | Count |");
    expect(report).toContain("| error | `broken-internal-link` | 1 |");
    expect(report).toContain("## deploy-app");
    expect(report).toContain("## guides/tak-guide");
    expect(report).toContain(`(${OUTLINE_DOC_BASE}a-Aa11111111)`);
  });
});
