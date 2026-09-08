import { API_SPEC_SOURCES, RELEASE_DOC_SOURCES } from "@config/collections";
import type {
  LocaleManifest,
  ManifestCollection,
} from "@shared/content-schema";
import { withBase } from "@/lib/base";

/** The developer-docs spine, shared by the sidebar, the shelf and the sheets. */

export type DevSectionKey =
  | "start"
  | "platform"
  | "core"
  | "integrations"
  | "project";

const SECTIONS: {
  key: DevSectionKey;
  labelKey: string;
  books: string[];
}[] = [
  { key: "start", labelKey: "devNav.start", books: ["introduction"] },
  {
    key: "platform",
    labelKey: "devNav.platform",
    books: ["architecture", "operate"],
  },
  { key: "core", labelKey: "devNav.core", books: ["develop-deploy-app"] },
  {
    key: "integrations",
    labelKey: "devNav.integrations",
    books: ["build-an-integration", "working-with-tak", "mediamtx", "matrix"],
  },
  {
    key: "project",
    labelKey: "devNav.project",
    books: ["contribute-to-project"],
  },
];

export interface DevRef {
  kind: "api" | "changelog";
  /** Manifest id — the spec source / release component to open. */
  id: string;
}

export type DevRefsByBook = ReadonlyMap<string, DevRef[]>;

export interface DevNavBook {
  book: ManifestCollection;
  refs: DevRef[];
}

export interface DevNavSection {
  key: DevSectionKey;
  labelKey: string;
  books: DevNavBook[];
}

interface SpecsManifest {
  sources?: { id: string; versions?: unknown[] }[];
}
interface ReleasesManifest {
  components?: {
    id: string;
    releases?: unknown[];
    changelogFile?: string;
    releaseNotesFile?: string;
  }[];
}

async function fetchJson<T>(path: string): Promise<T | undefined> {
  try {
    const res = await fetch(withBase(path));
    return res.ok ? ((await res.json()) as T) : undefined;
  } catch {
    return undefined;
  }
}

let cached: Promise<DevRefsByBook> | undefined;

/** Book slug -> its reference pages, limited to what has synced content. */
export function loadDevRefs(): Promise<DevRefsByBook> {
  cached ??= build();
  return cached;
}

async function build(): Promise<DevRefsByBook> {
  const [specs, releases] = await Promise.all([
    fetchJson<SpecsManifest>("/api-specs/manifest.json"),
    fetchJson<ReleasesManifest>("/release-docs/manifest.json"),
  ]);

  const withSpec = new Set(
    (specs?.sources ?? [])
      .filter((s) => (s.versions?.length ?? 0) > 0)
      .map((s) => s.id),
  );
  const withReleases = new Set(
    (releases?.components ?? [])
      .filter(
        (c) =>
          (c.releases?.length ?? 0) > 0 ||
          !!c.changelogFile ||
          !!c.releaseNotesFile,
      )
      .map((c) => c.id),
  );

  const byBook = new Map<string, DevRef[]>();
  const add = (book: string | undefined, ref: DevRef) => {
    if (!book) return;
    const list = byBook.get(book);
    if (list) list.push(ref);
    else byBook.set(book, [ref]);
  };

  for (const source of API_SPEC_SOURCES) {
    if (withSpec.has(source.id))
      add(source.book, { kind: "api", id: source.id });
  }
  for (const source of RELEASE_DOC_SOURCES) {
    if (withReleases.has(source.id)) {
      add(source.book, { kind: "changelog", id: source.id });
    }
  }
  return byBook;
}

export function devNavSections(
  manifest: LocaleManifest,
  refs: DevRefsByBook,
): DevNavSection[] {
  const bySlug = new Map(
    manifest.collections
      .filter((c) => c.section === "dev")
      .map((c) => [c.slug, c] as const),
  );
  const entry = (book: ManifestCollection): DevNavBook => ({
    book,
    refs: refs.get(book.slug) ?? [],
  });

  const sections = SECTIONS.map((section) => ({
    key: section.key,
    labelKey: section.labelKey,
    books: section.books
      .map((slug) => bySlug.get(slug))
      .filter((book): book is ManifestCollection => book !== undefined)
      .map(entry),
  }));

  // An unassigned dev book still shows up, rather than vanishing.
  const assigned = new Set(SECTIONS.flatMap((s) => s.books));
  const orphans = [...bySlug.values()].filter((c) => !assigned.has(c.slug));
  if (orphans.length > 0) {
    sections[sections.length - 1].books.push(...orphans.map(entry));
  }

  return sections.filter((section) => section.books.length > 0);
}
