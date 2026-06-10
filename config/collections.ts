/**
 * Outline collection registry — which collections sync to the site and where
 * they appear. Ported from the old wiki's scripts/wiki-conf.ts (same UUIDs).
 *
 * HOW TO ADD A COLLECTION
 * 1. Copy the collection UUID from Outline (URL or settings page).
 * 2. Pick a URL slug. Slugs with "/" group on a shelf ("guides/x", "wikis/x");
 *    slugs without "/" are standalone books.
 * 3. Pick the section: which tab the book lives under.
 * 4. Add an entry below and include it in ALL_COLLECTIONS.
 * 5. Run `pnpm sync:outline` and open a PR.
 */

export type Section = "deploy-app" | "guides" | "dev" | "wikis";

export interface CollectionConfig {
  /** Outline collection UUID. */
  collectionId: string;
  label: string;
  /** URL slug segment(s); "/" creates a shelf group. */
  slug: string;
  section: Section;
  description: string;
  /** Set when a collection has no en/fi/sv locale root docs (treated as en). */
  noLocale?: boolean;
}

export const MAIN_COLLECTION: CollectionConfig = {
  collectionId: "d80e5aab-46b6-4518-8719-449e8cf7fd06",
  label: "Deploy App",
  slug: "deploy-app",
  section: "deploy-app",
  description: "Main application documentation",
};

export const GUIDE_COLLECTIONS: CollectionConfig[] = [
  {
    collectionId: "2ed45fcf-9424-4774-b5f9-9a66f7c1a009",
    label: "TAK Guide",
    slug: "guides/tak-guide",
    section: "guides",
    description: "TAK platform guide",
  },
  {
    collectionId: "2821f4e0-273d-42e9-a410-2059dd43e35c",
    label: "MTX Guide",
    slug: "guides/mtx-guide",
    section: "guides",
    description: "MTX platform guide",
  },
  {
    collectionId: "197bf6c2-f095-4a31-af4d-7c0cef365ee4",
    label: "Matrix Guide",
    slug: "guides/matrix-guide",
    section: "guides",
    description: "Matrix platform guide",
  },
  {
    collectionId: "1fa15405-4e21-4d83-be45-f0d263e2c790",
    label: "CryptPad Guide",
    slug: "guides/cryptpad-guide",
    section: "guides",
    description: "CryptPad platform guide",
  },
];

export const WIKI_COLLECTIONS: CollectionConfig[] = [
  {
    collectionId: "9829b981-a0ec-40c4-af9a-5c15a756adf6",
    label: "TAK Wiki",
    slug: "wikis/tak",
    section: "wikis",
    description: "TAK technical reference",
  },
  {
    collectionId: "d4a599cf-e747-496e-852e-0413526270ad",
    label: "MTX Wiki",
    slug: "wikis/mtx",
    section: "wikis",
    description: "MTX technical reference",
  },
];

export const FOR_DEVELOPERS_COLLECTION: CollectionConfig = {
  collectionId: "ad2a59bd-ef5b-4cfe-b43a-af69884cbe2a",
  label: "For Developers",
  slug: "dev",
  section: "dev",
  description: "Developer-focused documentation",
};

export const ALL_COLLECTIONS: CollectionConfig[] = [
  MAIN_COLLECTION,
  ...GUIDE_COLLECTIONS,
  ...WIKI_COLLECTIONS,
  FOR_DEVELOPERS_COLLECTION,
];

export function getCollectionBySlug(
  slug: string,
): CollectionConfig | undefined {
  return ALL_COLLECTIONS.find((c) => c.slug === slug);
}

export function getCollectionById(id: string): CollectionConfig | undefined {
  return ALL_COLLECTIONS.find((c) => c.collectionId === id);
}

export function getCollectionsBySection(section: Section): CollectionConfig[] {
  return ALL_COLLECTIONS.filter((c) => c.section === section);
}

export function validateCollectionConfig(): void {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  for (const collection of ALL_COLLECTIONS) {
    if (ids.has(collection.collectionId)) {
      throw new Error(
        `Duplicate collection ID: ${collection.collectionId} (${collection.label})`,
      );
    }
    ids.add(collection.collectionId);

    if (slugs.has(collection.slug)) {
      throw new Error(
        `Duplicate collection slug: ${collection.slug} (${collection.label})`,
      );
    }
    slugs.add(collection.slug);

    if (!uuidRegex.test(collection.collectionId)) {
      throw new Error(
        `Invalid collection ID format: ${collection.collectionId} (${collection.label})`,
      );
    }
  }
}

/** OpenAPI spec sources for the embedded Scalar reference. */
export interface ApiSpecSource {
  id: string;
  name: string;
  kind: "gh-pages" | "release-assets";
  /** gh-pages: direct URL to openapi.json. */
  url?: string;
  /** release-assets: GitHub repo + asset path inside each release. */
  repo?: string;
  assetPath?: string;
  maxVersions?: number;
}

export const API_SPEC_SOURCES: ApiSpecSource[] = [
  {
    id: "rasenmaeher",
    name: "Deploy App Core API",
    kind: "gh-pages",
    url: "https://pvarki.github.io/docker-rasenmaeher-integration/openapi.json",
  },
];
