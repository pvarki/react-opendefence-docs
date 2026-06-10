/**
 * Script-internal types for the Outline sync pipeline.
 *
 * Only shapes the pipeline needs at run time live here. Everything written to
 * public/content/ is typed by shared/content-schema.ts, and collection config
 * lives in config/collections.ts — do not duplicate those here.
 */
import { z } from "zod";
import type { Locale } from "../../shared/content-schema";

// Re-exported for script convenience so pipeline modules have one import site.
export {
  LOCALES,
  DEFAULT_LOCALE,
  normalizeLocale,
} from "../../shared/content-schema";
export type { Locale } from "../../shared/content-schema";

// ---------------------------------------------------------------------------
// Outline navigation tree (collections.documents response)
// ---------------------------------------------------------------------------

/**
 * One node of the nav tree returned by /collections.documents. `url` is
 * rewritten by the API client to a site route path; `locale` is stamped on
 * during tree flattening (top-level docs are locale folders named "en"/"fi"/
 * "sv"/"se" in Outline).
 */
export interface OutlineNavNode {
  id: string;
  url: string;
  title: string;
  text?: string;
  collectionId?: string;
  parentDocumentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
  children: OutlineNavNode[];
  locale?: string;
}

/** Old pipeline name for the nav node; kept so ported call sites read 1:1. */
export type OutlineDocument = OutlineNavNode;

/**
 * Schema for an Outline document from the API. `children` is absent on leaf
 * nodes in the API response, hence the .default([]).
 */
export const OutlineNavNodeSchema: z.ZodType<
  OutlineNavNode,
  z.ZodTypeDef,
  unknown
> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    url: z.string(),
    title: z.string(),
    text: z.string().optional(),
    collectionId: z.string().uuid().optional(),
    parentDocumentId: z.string().uuid().nullable().optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
    publishedAt: z.string().datetime().nullable().optional(),
    children: z.array(OutlineNavNodeSchema).optional().default([]),
    locale: z.string().optional(),
  }),
);

/** Old pipeline name for the node schema. */
export const OutlineDocumentSchema = OutlineNavNodeSchema;

/** Schema for the collection structure response (array of root nodes). */
export const OutlineDocumentStructureSchema = z.array(OutlineNavNodeSchema);

export type OutlineDocumentStructure = z.infer<
  typeof OutlineDocumentStructureSchema
>;

/**
 * Locale-keyed collection structure: one nav-tree root per locale folder.
 * Collections flagged `noLocale` get a synthetic "en" root.
 */
export type LocaleCollection = Partial<Record<Locale, OutlineNavNode>>;

// ---------------------------------------------------------------------------
// Document info / download results
// ---------------------------------------------------------------------------

/** Basic document info returned from the documents.info endpoint. */
export interface OutlineDocumentInfo {
  id: string;
  url: string;
  title: string;
  collectionId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Result of documents.export: the markdown plus every attachment from the ZIP
 * (keyed by ZIP entry name, e.g. "attachments/<uuid>.png").
 */
export interface DocumentDownload {
  markdown: string;
  images: Map<string, Buffer>;
}

// ---------------------------------------------------------------------------
// Caches — shared across collections within one sync run so documents.info is
// never fetched twice for the same doc.
// ---------------------------------------------------------------------------

export type DocumentInfoCache = Map<string, OutlineDocumentInfo>;

/** Keyed by Outline collection UUID. */
export type CollectionStructureCache = Map<string, LocaleCollection>;

// ---------------------------------------------------------------------------
// Sync options & statistics
// ---------------------------------------------------------------------------

/** Parsed CLI flags for sync-outline. */
export interface SyncOptions {
  /** Re-download everything, ignoring updatedAt comparison. */
  force: boolean;
  /** Substring/prefix filter on collection slugs. */
  collection?: string;
  verbose: boolean;
  /** Plain timestamped logs instead of spinners/progress bars. */
  ci: boolean;
}

/** Statistics for a single collection sync. */
export interface CollectionSyncStats {
  label: string;
  slug: string;
  duration: number;
  documentsProcessed: number;
  documentsSkipped: number;
  imagesSaved: number;
  errors: string[];
}

/** Overall sync statistics. */
export interface SyncStats {
  startTime: number;
  endTime?: number;
  totalDocuments: number;
  successfulSyncs: number;
  failedSyncs: number;
  skippedSyncs: number;
  totalImages: number;
  collections: CollectionSyncStats[];
}
