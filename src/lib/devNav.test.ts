import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type LocaleManifest } from "@shared/content-schema";
import { devNavSections, type DevRefsByBook } from "./devNav";

const manifest = (devSlugs: string[]): LocaleManifest => ({
  schemaVersion: SCHEMA_VERSION,
  locale: "en",
  generatedAt: "2026-01-01T00:00:00.000Z",
  collections: [
    {
      slug: "deploy-app",
      label: "Deploy App",
      section: "deploy-app",
      order: 0,
    },
    ...devSlugs.map((slug, order) => ({
      slug,
      label: slug,
      section: "dev" as const,
      order,
    })),
  ],
  pages: [],
});

const ALL_DEV = [
  "matrix",
  "introduction",
  "contribute-to-project",
  "architecture",
  "working-with-tak",
  "operate",
  "mediamtx",
  "develop-deploy-app",
  "build-an-integration",
];

const noRefs: DevRefsByBook = new Map();

describe("devNavSections", () => {
  it("groups dev books into the spine, regardless of manifest order", () => {
    const sections = devNavSections(manifest(ALL_DEV), noRefs);
    expect(
      sections.map((s) => [s.key, s.books.map((b) => b.book.slug)]),
    ).toEqual([
      ["start", ["introduction"]],
      ["platform", ["architecture", "operate"]],
      ["core", ["develop-deploy-app"]],
      [
        "integrations",
        ["build-an-integration", "working-with-tak", "mediamtx", "matrix"],
      ],
      ["project", ["contribute-to-project"]],
    ]);
  });

  it("drops sections whose books are not synced", () => {
    const sections = devNavSections(manifest(["introduction"]), noRefs);
    expect(sections.map((s) => s.key)).toEqual(["start"]);
  });

  it("attaches a spec or changelog to its own book", () => {
    const refs: DevRefsByBook = new Map([
      ["matrix", [{ kind: "changelog" as const, id: "python-matrix-rmapi" }]],
    ]);
    const sections = devNavSections(manifest(ALL_DEV), refs);
    const books = sections.flatMap((s) => s.books);
    expect(books.find((b) => b.book.slug === "matrix")?.refs).toEqual([
      { kind: "changelog", id: "python-matrix-rmapi" },
    ]);
    expect(books.find((b) => b.book.slug === "mediamtx")?.refs).toEqual([]);
  });

  it("keeps a book no section claims visible", () => {
    const sections = devNavSections(
      manifest(["introduction", "surprise"]),
      noRefs,
    );
    expect(sections.at(-1)?.books.map((b) => b.book.slug)).toContain(
      "surprise",
    );
  });
});
