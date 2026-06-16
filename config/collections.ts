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
  description: "Learn how to join and add users to a server",
};

export const GUIDE_COLLECTIONS: CollectionConfig[] = [
  {
    collectionId: "2ed45fcf-9424-4774-b5f9-9a66f7c1a009",
    label: "TAK Guide",
    slug: "guides/tak-guide",
    section: "guides",
    description: "Learn how to use TAK for situational awareness",
  },
  {
    collectionId: "2821f4e0-273d-42e9-a410-2059dd43e35c",
    label: "MTX Guide",
    slug: "guides/mtx-guide",
    section: "guides",
    description: "Learn how to stream and view video from drones and phones",
  },
  {
    collectionId: "197bf6c2-f095-4a31-af4d-7c0cef365ee4",
    label: "Matrix Guide",
    slug: "guides/matrix-guide",
    section: "guides",
    description: "Learn how to use Matrix for secure messaging with Deploy App",
  },
  {
    collectionId: "1fa15405-4e21-4d83-be45-f0d263e2c790",
    label: "CryptPad Guide",
    slug: "guides/cryptpad-guide",
    section: "guides",
    description: "Learn how to share files and work together with CryptPad",
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

// Audience-organized developer books — separate books on the Develop shelf.
// Operate / Develop Deploy App / Build an Integration carry the Docker↔K8s
// platform toggle; Introduction and Contribute to Project are platform-agnostic.
// The "For Developers" book above stays as the existing K8s component reference.
export const DEV_BOOK_COLLECTIONS: CollectionConfig[] = [
  {
    collectionId: "dc4aa3b7-2495-4b8a-b8db-bc79d65fe4d1",
    label: "Introduction",
    slug: "introduction",
    section: "dev",
    description: "Start here: what Deploy App is and how to choose a platform",
  },
  {
    collectionId: "05529a3a-64f0-475a-9078-00c101d9b551",
    label: "Operate",
    slug: "operate",
    section: "dev",
    description: "Deploy and run Deploy App",
  },
  {
    collectionId: "816041c3-4234-4cbe-b4fc-bdd7cd8203ec",
    label: "Develop Deploy App",
    slug: "develop-deploy-app",
    section: "dev",
    description: "Work on the Deploy App core (rmapi)",
  },
  {
    collectionId: "be2f879f-ab44-4830-a043-dd305d4c65b3",
    label: "Build an Integration",
    slug: "build-an-integration",
    section: "dev",
    description: "Build a product integration API for Deploy App",
  },
  {
    collectionId: "97398f22-736c-4e41-b8f3-4e90f6c98533",
    label: "Contribute to Project",
    slug: "contribute-to-project",
    section: "dev",
    description: "Contribute across the pvarki repositories",
  },
];

export const ALL_COLLECTIONS: CollectionConfig[] = [
  MAIN_COLLECTION,
  ...GUIDE_COLLECTIONS,
  ...WIKI_COLLECTIONS,
  ...DEV_BOOK_COLLECTIONS,
  // FOR_DEVELOPERS_COLLECTION dropped from the site (superseded by the 5
  // dev books above). Its Outline collection is left intact.
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

/** A single `servers[]` entry, optionally templated with OpenAPI variables. */
export interface SpecOverlayServer {
  url: string;
  description?: string;
  variables?: Record<
    string,
    { default: string; description?: string; enum?: string[] }
  >;
}

/**
 * Cosmetic enrichment re-applied to a fetched spec on every sync.
 *
 * Raw FastAPI specs ship `info.title` = "FastAPI", no `info.description` and no
 * `servers[]`, so the embedded reference would otherwise read "FastAPI 1.4.0"
 * with no overview or base URL. Keeping the overlay here (not hand-edited into
 * the synced JSON) means `pnpm fetch:api-specs` can't revert the branding.
 */
export interface SpecOverlay {
  /** Replaces `info.title`. */
  title?: string;
  /** Replaces `info.description` — markdown, rendered atop the reference. */
  description?: string;
  /** Replaces `servers[]`. */
  servers?: SpecOverlayServer[];
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
  /** Branding/overview re-applied after each download (see {@link SpecOverlay}). */
  overlay?: SpecOverlay;
}

export const API_SPEC_SOURCES: ApiSpecSource[] = [
  {
    id: "rasenmaeher",
    name: "Deploy App Core API",
    kind: "gh-pages",
    url: "https://pvarki.github.io/docker-rasenmaeher-integration/openapi.json",
    overlay: {
      title: "Deploy App Core API",
      description: [
        "The **Deploy App Core API** (codename *RASENMAEHER*) is the identity,",
        "certificate and enrollment backend behind Deploy App. Product",
        "integrations and operators use it to enroll users, issue and renew mTLS",
        "client certificates, and validate access.",
        "",
        "## Base URL",
        "",
        "All endpoints live under `/api/v1`. The host is assigned per deployment",
        "(for example `your-deployment.pvarki.fi`) — pick it in the server",
        "selector above or substitute your own instance's hostname.",
        "",
        "## Authentication",
        "",
        "Endpoints accept one of two credentials, depending on the operation:",
        "",
        "- **Bearer JWT** — send `Authorization: Bearer <token>` (scheme",
        "  `JWTBearer`).",
        "- **mTLS client certificate** — present your client certificate; the",
        "  mTLS-terminating proxy forwards it to the API (schemes `MTLSHeader` /",
        "  `MTLSorJWT`). Some operations accept either, or additionally require a",
        "  valid user (`ValidUser`).",
        "",
        "Each operation below lists the exact credential it expects.",
      ].join("\n"),
      servers: [
        {
          url: "https://{deployment}.pvarki.fi",
          description:
            "Your Deploy App deployment. The host is assigned per installation; " +
            "replace {deployment} with your instance's hostname.",
          variables: {
            deployment: {
              default: "your-deployment",
              description:
                "Deployment hostname prefix assigned to your Deploy App instance.",
            },
          },
        },
      ],
    },
  },
];

/** Release-dependent doc sources fetched from each pvarki component repo. */
export interface ReleaseDocSource {
  /** URL-safe component slug; also the folder under public/release-docs/. */
  id: string;
  /** Display name on the Releases page. */
  name: string;
  /** GitHub repo "owner/name". */
  repo: string;
  /** Default branch for raw CHANGELOG/RELEASE_NOTES fetches. Default "main". */
  branch?: string;
  /** Path to the changelog in the repo. Default "CHANGELOG.md". */
  changelogPath?: string;
  /** Path to optional human release notes. Default "RELEASE_NOTES.md". */
  releaseNotesPath?: string;
  /** How many GitHub releases to surface, newest-first. Default 10. */
  maxVersions?: number;
}

/**
 * Component repos whose release notes / changelogs feed the on-site Releases
 * page. Fetched (and committed) by scripts/fetch-release-docs.ts, mirroring the
 * OpenAPI-spec fetch above. Adding a repo here surfaces it automatically.
 */
export const RELEASE_DOC_SOURCES: ReleaseDocSource[] = [
  {
    id: "docker-rasenmaeher-integration",
    name: "Deploy App Core (RASENMAEHER, legacy)",
    repo: "pvarki/docker-rasenmaeher-integration",
  },
  {
    id: "opendefence-platform",
    name: "OpenDefence Platform (K8s)",
    repo: "pvarki/opendefence-platform",
  },
  {
    id: "python-integration-template",
    name: "Integration Template (rmapi)",
    repo: "pvarki/python-integration-template",
  },
  {
    id: "python-matrix-rmapi",
    name: "Matrix Integration (example)",
    repo: "pvarki/python-matrix-rmapi",
  },
  // NB: deployapp-runbook is an Outline export, not a GitHub repo — its content
  // is authored in Outline (Developer Guide), so it has no release feed here.
];
