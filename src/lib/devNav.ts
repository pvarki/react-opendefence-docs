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

export type DevRefKind = "api" | "releases" | "notes" | "changelog";

export const REF_LABEL_KEY: Record<DevRefKind, string> = {
  api: "apiRef.title",
  releases: "releases.title",
  notes: "releases.releaseNotes",
  changelog: "releases.changelog",
};

export interface DevRef {
  kind: DevRefKind;
  /** Dev book slug — the URL segment, and the key back to the config source. */
  book: string;
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

// Exported so the generated route tree can name the loader's return type.
export interface SpecSource {
  id: string;
  name: string;
  versions: { tag: string; specFile: string }[];
}

export interface ReleaseComponent {
  id: string;
  name: string;
  releases: { tag: string; file: string; prerelease?: boolean }[];
  changelogFile?: string;
  releaseNotesFile?: string;
}

async function fetchJson<T>(path: string): Promise<T | undefined> {
  try {
    const res = await fetch(withBase(path));
    return res.ok ? ((await res.json()) as T) : undefined;
  } catch {
    return undefined;
  }
}

// Static files: fetched once per session, shared by the nav and the ref pages.
let specs: Promise<SpecSource[]> | undefined;
let components: Promise<ReleaseComponent[]> | undefined;

function loadSpecs(): Promise<SpecSource[]> {
  specs ??= fetchJson<{ sources?: SpecSource[] }>(
    "/api-specs/manifest.json",
  ).then((m) => m?.sources ?? []);
  return specs;
}

function loadComponents(): Promise<ReleaseComponent[]> {
  components ??= fetchJson<{ components?: ReleaseComponent[] }>(
    "/release-docs/manifest.json",
  ).then((m) => m?.components ?? []);
  return components;
}

/** The spec / release component documenting a book, via the config join. */
export async function specForBook(
  book: string,
): Promise<SpecSource | undefined> {
  const id = API_SPEC_SOURCES.find((s) => s.book === book)?.id;
  return (await loadSpecs()).find((s) => s.id === id);
}

export async function releasesForBook(
  book: string,
): Promise<ReleaseComponent | undefined> {
  const id = RELEASE_DOC_SOURCES.find((s) => s.book === book)?.id;
  return (await loadComponents()).find((c) => c.id === id);
}

let cached: Promise<DevRefsByBook> | undefined;

/** Book slug -> its reference pages, limited to what has synced content. */
export function loadDevRefs(): Promise<DevRefsByBook> {
  cached ??= build();
  return cached;
}

/** One ref per view that has content, so a link never lands on an empty tab. */
export function refsFrom(
  specs: SpecSource[],
  components: ReleaseComponent[],
): DevRefsByBook {
  const withSpec = new Set(
    specs.filter((s) => s.versions.length > 0).map((s) => s.id),
  );
  const byId = new Map(components.map((c) => [c.id, c] as const));
  const byBook = new Map<string, DevRef[]>();
  const add = (book: string | undefined, kind: DevRefKind) => {
    if (!book) return;
    const list = byBook.get(book) ?? [];
    list.push({ kind, book });
    byBook.set(book, list);
  };

  for (const source of API_SPEC_SOURCES) {
    if (withSpec.has(source.id)) add(source.book, "api");
  }
  for (const source of RELEASE_DOC_SOURCES) {
    const c = byId.get(source.id);
    if (!c) continue;
    if (c.releases.length > 0) add(source.book, "releases");
    if (c.releaseNotesFile) add(source.book, "notes");
    if (c.changelogFile) add(source.book, "changelog");
  }
  return byBook;
}

async function build(): Promise<DevRefsByBook> {
  const [specs, components] = await Promise.all([
    loadSpecs(),
    loadComponents(),
  ]);
  return refsFrom(specs, components);
}

export function devNavSections(
  manifest: LocaleManifest,
  refs: DevRefsByBook = new Map(),
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
