/**
 * Content schemas shared between the sync pipeline (scripts/) and the app (src/).
 *
 * Everything under public/content/ is validated against these schemas: the
 * pipeline guarantees them on write, the app trusts-but-verifies on read.
 * Bump `schemaVersion` on breaking shape changes so stale precached JSON from
 * an older service worker is detected instead of misrendered.
 */
import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

export const LOCALES = ["en", "fi", "sv"] as const;
export const LocaleSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof LocaleSchema>;
export const DEFAULT_LOCALE: Locale = "en";

/** Maps legacy/alternate codes ("se") onto supported locales. */
export function normalizeLocale(raw: string): Locale | undefined {
  const lower = raw.trim().toLowerCase();
  if (lower === "se") return "sv";
  return LOCALES.find((l) => l === lower);
}

// ---------------------------------------------------------------------------
// Platforms — guides are authored per platform in Outline (top-level
// organizer docs: Android/iOS/... or client names like ATAK/iTAK/WinTAK).
// The reader shows one platform at a time, selected in the navbar.
// ---------------------------------------------------------------------------

export const PLATFORMS = [
  "android",
  "ios",
  "windows",
  "linux",
  "macos",
] as const;
export const PlatformSchema = z.enum(PLATFORMS);
export type Platform = z.infer<typeof PlatformSchema>;

export const PlatformInfoSchema = z.object({
  key: PlatformSchema,
  /** Book-specific display label (e.g. "ATAK" for android in the TAK guide). */
  label: z.string(),
  /** The platform's organizer doc carries the under-development marker. */
  underDevelopment: z.boolean().optional(),
});
export type PlatformInfo = z.infer<typeof PlatformInfoSchema>;

// ---------------------------------------------------------------------------
// Blocks — a page body is an ordered list of typed blocks. HTML is sanitized
// at build time (rehype-sanitize); the app renders it without re-processing.
// ---------------------------------------------------------------------------

export const SlideLayoutSchema = z.enum([
  "image-bottom",
  "image-left",
  "image-right",
  "grid",
  "text",
]);
export type SlideLayout = z.infer<typeof SlideLayoutSchema>;

export const SlideImageSchema = z.object({
  src: z.string(),
  alt: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type SlideImage = z.infer<typeof SlideImageSchema>;

export const SlideSchema = z.object({
  title: z.string().optional(),
  layout: SlideLayoutSchema,
  /** Slide body rendered to sanitized HTML at build time. */
  html: z.string(),
  images: z.array(SlideImageSchema),
});
export type Slide = z.infer<typeof SlideSchema>;

export const HtmlBlockSchema = z.object({
  type: z.literal("html"),
  html: z.string(),
});

export const SlidesetBlockSchema = z.object({
  type: z.literal("slideset"),
  /** Which authoring convention produced it (canonical = META: slides). */
  source: z.enum(["canonical", "legacy"]),
  title: z.string().optional(),
  slides: z.array(SlideSchema).min(1),
});
export type SlidesetBlock = z.infer<typeof SlidesetBlockSchema>;

export const ImageBlockSchema = z.object({
  type: z.literal("image"),
  src: z.string(),
  alt: z.string(),
  caption: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const YoutubeBlockSchema = z.object({
  type: z.literal("youtube"),
  videoId: z.string(),
  title: z.string().optional(),
});

export const PdfBlockSchema = z.object({
  type: z.literal("pdf"),
  src: z.string(),
  title: z.string().optional(),
});

export const CodeBlockSchema = z.object({
  type: z.literal("code"),
  /** shiki-rendered HTML (build time). */
  html: z.string(),
  lang: z.string(),
  title: z.string().optional(),
});

export const BlockSchema = z.discriminatedUnion("type", [
  HtmlBlockSchema,
  SlidesetBlockSchema,
  ImageBlockSchema,
  YoutubeBlockSchema,
  PdfBlockSchema,
  CodeBlockSchema,
]);
export type Block = z.infer<typeof BlockSchema>;

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export const HeadingSchema = z.object({
  depth: z.union([z.literal(2), z.literal(3)]),
  text: z.string(),
  id: z.string(),
});
export type Heading = z.infer<typeof HeadingSchema>;

export const PageDocSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** Outline document UUID. */
  id: z.string(),
  /** Outline url slug incl. shortid suffix, e.g. "first-login-qwmPnmJsrF". */
  slug: z.string(),
  /** Collection slug, e.g. "deploy-app" or "guides/tak-guide". */
  collection: z.string(),
  locale: LocaleSchema,
  title: z.string(),
  breadcrumb: z.array(z.string()),
  createdAt: z.string(),
  /** Drives incremental sync (string-compared against documents.info). */
  updatedAt: z.string(),
  headings: z.array(HeadingSchema),
  /** Route paths of this document in other locales. */
  translations: z.record(z.string(), z.string()).optional(),
  underDevelopment: z.boolean().optional(),
  blocks: z.array(BlockSchema),
});
export type PageDoc = z.infer<typeof PageDocSchema>;

// ---------------------------------------------------------------------------
// Manifest — one per locale; the app's map of everything. `order` within a
// collection is the flattened reading order that drives swipe and prev/next.
// ---------------------------------------------------------------------------

export const ManifestPageSchema = z.object({
  id: z.string(),
  slug: z.string(),
  collection: z.string(),
  title: z.string(),
  breadcrumb: z.array(z.string()),
  /** Fetch path of the page JSON, e.g. "/content/en/pages/deploy-app/foo.json". */
  path: z.string(),
  updatedAt: z.string(),
  /** Position in the collection's reading order (0 = book cover side). */
  order: z.number().int().nonnegative(),
  /** Under development / explicitly hidden: excluded from reading order & search. */
  hidden: z.boolean().optional(),
  /** Platform this page belongs to; absent = shown on every platform. */
  platform: PlatformSchema.optional(),
  /** Chapter (Outline organizer doc) this page belongs to. */
  chapterId: z.string().optional(),
  chapterLabel: z.string().optional(),
});
export type ManifestPage = z.infer<typeof ManifestPageSchema>;

export const ManifestCollectionSchema = z.object({
  slug: z.string(),
  label: z.string(),
  description: z.string().optional(),
  section: z.enum(["deploy-app", "guides", "dev", "wikis"]),
  order: z.number().int().nonnegative(),
  /** Platforms this book is authored for (absent = platform-agnostic book). */
  platforms: z.array(PlatformInfoSchema).optional(),
});
export type ManifestCollection = z.infer<typeof ManifestCollectionSchema>;

export const LocaleManifestSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  locale: LocaleSchema,
  generatedAt: z.string(),
  collections: z.array(ManifestCollectionSchema),
  pages: z.array(ManifestPageSchema),
});
export type LocaleManifest = z.infer<typeof LocaleManifestSchema>;

// ---------------------------------------------------------------------------
// Sidebar / book tree — per collection, per locale. Nesting is capped at two
// visible levels (group > page) by the sync-time flattener.
// ---------------------------------------------------------------------------

export interface SidebarItem {
  type: "group" | "doc" | "link";
  id: string;
  label: string;
  /** Doc slug for type "doc"; href for type "link". */
  slug?: string;
  href?: string;
  /** Groups under a platform organizer carry its key; the TOC filters by it. */
  platform?: Platform;
  children?: SidebarItem[];
}

export const SidebarItemSchema: z.ZodType<SidebarItem> = z.lazy(() =>
  z.object({
    type: z.enum(["group", "doc", "link"]),
    id: z.string(),
    label: z.string(),
    slug: z.string().optional(),
    href: z.string().optional(),
    platform: PlatformSchema.optional(),
    children: z.array(SidebarItemSchema).optional(),
  }),
);

export const SidebarConfigSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  label: z.string(),
  slug: z.string(),
  items: z.array(SidebarItemSchema),
});
export type SidebarConfig = z.infer<typeof SidebarConfigSchema>;

// ---------------------------------------------------------------------------
// Cross-locale translations mapping: bareSlug -> locale -> route path.
// ---------------------------------------------------------------------------

export const TranslationsFileSchema = z.record(
  z.string(),
  z.record(z.string(), z.string()),
);
export type TranslationsFile = z.infer<typeof TranslationsFileSchema>;

// ---------------------------------------------------------------------------
// Old docs.pvarki.fi path -> new path map, consulted before 404.
// ---------------------------------------------------------------------------

export const RedirectsFileSchema = z.record(z.string(), z.string());
export type RedirectsFile = z.infer<typeof RedirectsFileSchema>;
