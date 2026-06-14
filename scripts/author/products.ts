/**
 * Authoring targets: where each product/platform lives in Outline.
 *
 * Maps a friendly (product, platform) pair to the concrete Outline ids the
 * scaffold/push scripts need — so we never hand-type UUIDs. Collection ids come
 * from config/collections.ts; the per-platform *organizer* document ids are the
 * English platform organizers already created in Outline and enumerated in
 * scripts/add-meta-markers.mts (the `META: os/product` markers live on them).
 *
 * Only the English (En) locale roots are targeted for now — that's the locked
 * default locale and the pilot scope. Add fi/sv organizer ids here when those
 * platform trees exist in Outline.
 */
import { MAIN_COLLECTION, GUIDE_COLLECTIONS } from "../../config/collections";

const takCollectionId = GUIDE_COLLECTIONS.find(
  (c) => c.slug === "guides/tak-guide",
)!.collectionId;
const matrixCollectionId = GUIDE_COLLECTIONS.find(
  (c) => c.slug === "guides/matrix-guide",
)!.collectionId;

export interface PlatformTarget {
  /** Platform/client key used on the CLI (e.g. "android", "atak"). */
  key: string;
  /** Human label as it reads in Outline / the platform selector. */
  label: string;
  /** Outline organizer document id (En) that chapters/pages hang under. */
  organizerId: string;
}

export interface ProductTarget {
  /** CLI key (e.g. "deploy-app", "tak", "matrix"). */
  key: string;
  label: string;
  collectionId: string;
  /**
   * Platform-aware products list their platform organizers here. Empty for
   * platform-agnostic books — those hang pages directly off the En locale root,
   * which the push script resolves at runtime via collections.documents.
   */
  platforms: PlatformTarget[];
}

export const PRODUCTS: Record<string, ProductTarget> = {
  "deploy-app": {
    key: "deploy-app",
    label: MAIN_COLLECTION.label,
    collectionId: MAIN_COLLECTION.collectionId,
    platforms: [
      {
        key: "android",
        label: "Android",
        organizerId: "356a70b8-4ac4-470f-ae30-9a4249c7f989",
      },
      {
        key: "ios",
        label: "iOS",
        organizerId: "ee7d4162-9d19-4631-9d5e-b8a0181bdeaf",
      },
      {
        key: "windows",
        label: "Windows",
        organizerId: "8e3fdeae-6802-4988-926f-474a171eeb67",
      },
      {
        key: "linux",
        label: "Linux",
        organizerId: "64905c3d-3a72-4ab6-9d76-025444037001",
      },
      {
        key: "macos",
        label: "MacOS",
        organizerId: "408b4bff-52ff-4884-a66c-31a112d5546a",
      },
    ],
  },
  tak: {
    key: "tak",
    label: "TAK Guide",
    collectionId: takCollectionId,
    platforms: [
      {
        key: "atak",
        label: "ATAK",
        organizerId: "685f6f0f-e7ca-4ba3-807f-568582663e95",
      },
      {
        key: "wintak",
        label: "WinTAK",
        organizerId: "2797bf1c-40d6-43ca-8f4c-9314097ee396",
      },
      {
        key: "itak",
        label: "iTAK",
        organizerId: "a976f932-3cba-4bf5-82ab-d91bcca94b98",
      },
      {
        key: "tak-tracker-android",
        label: "TAK Tracker - Android",
        organizerId: "8227a4a8-5540-4624-a24d-91a5037cf456",
      },
      {
        key: "tak-tracker-apple",
        label: "TAK Tracker - Apple",
        organizerId: "2afa861e-7e13-4521-b433-48ab08d9a86f",
      },
    ],
  },
  matrix: {
    key: "matrix",
    label: "Matrix Guide",
    collectionId: matrixCollectionId,
    // Platform-agnostic: pages hang off the En locale root.
    platforms: [],
  },
};

export function getProduct(key: string): ProductTarget {
  const product = PRODUCTS[key];
  if (!product) {
    throw new Error(
      `Unknown product "${key}". Known: ${Object.keys(PRODUCTS).join(", ")}`,
    );
  }
  return product;
}

export function getPlatform(
  product: ProductTarget,
  platformKey: string,
): PlatformTarget {
  const platform = product.platforms.find((p) => p.key === platformKey);
  if (!platform) {
    const known = product.platforms.map((p) => p.key).join(", ") || "(none)";
    throw new Error(
      `Unknown platform "${platformKey}" for ${product.key}. Known: ${known}`,
    );
  }
  return platform;
}
