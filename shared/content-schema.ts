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

// OS platforms drive the end-user/product area selector (TAK, MTX, ...).
export const OS_PLATFORMS = [
  "android",
  "ios",
  "windows",
  "linux",
  "macos",
] as const;
// Deployment targets drive the developer-docs legacy-vs-new toggle. They are
// NOT shown in the generic OS picker — only as dev-book clients / the dev-area
// generic list.
export const DEPLOYMENT_PLATFORMS = [
  "docker-rasenmaeher-integration",
  "opendefence-k8s",
] as const;
export const PLATFORMS = [
  "android",
  "ios",
  "windows",
  "linux",
  "macos",
  "docker-rasenmaeher-integration",
  "opendefence-k8s",
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

/**
 * A client is one selectable content view of a book — usually an app for a
 * platform (ATAK, iTAK, WinTAK, TAK Tracker). Detected from organizer names
 * or an explicit "META: platform: <key>" line in the organizer doc body.
 * The selector lists a book's clients; the platform key links the choice to
 * the global platform preference.
 *
 * For product clients (META: product: yes), `platform` is the underlying OS
 * (e.g. android for ATAK) used for icon display and platform-filter routing.
 * The `os` field carries the same value when explicitly declared via META: os.
 * `isProduct` distinguishes named products (ATAK) from generic OS platforms
 * (Android) so the selector can show the product label instead of the OS name.
 */
export const ClientInfoSchema = z.object({
  /** Organizer doc slug — stable id, also stamped on its pages. */
  id: z.string(),
  label: z.string(),
  /** Underlying OS platform key; used for icon display and reading-order filter. */
  platform: PlatformSchema,
  /** Explicitly declared OS (META: os: <key>); present when set via marker. */
  os: PlatformSchema.optional(),
  /** True when this client is a named product (ATAK, WinTAK) rather than a generic OS. */
  isProduct: z.boolean().optional(),
  /** The client's organizer doc carries the under-development marker. */
  underDevelopment: z.boolean().optional(),
});
export type ClientInfo = z.infer<typeof ClientInfoSchema>;

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

export const MermaidBlockSchema = z.object({
  type: z.literal("mermaid"),
  /** Raw mermaid source; rendered to SVG client-side (heavy lib, lazy). */
  code: z.string(),
  title: z.string().optional(),
});

export const BlockSchema = z.discriminatedUnion("type", [
  HtmlBlockSchema,
  SlidesetBlockSchema,
  ImageBlockSchema,
  YoutubeBlockSchema,
  PdfBlockSchema,
  CodeBlockSchema,
  MermaidBlockSchema,
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
  /**
   * Platforms this page belongs to when it targets several at once (multiple
   * `#tag:` markers, e.g. a desktop guide for windows+macos+linux). Takes
   * precedence over `platform`; absent = fall back to `platform`/all.
   */
  platforms: z.array(PlatformSchema).optional(),
  /** Client (selector entry) this page belongs to; absent = all clients. */
  clientId: z.string().optional(),
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
  /** Clients this book is authored for (absent = platform-agnostic book). */
  clients: z.array(ClientInfoSchema).optional(),
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
  /** "toporg" = section heading grouping chapters (META: toporg in Outline). */
  type: "group" | "doc" | "link" | "toporg";
  id: string;
  label: string;
  /** Doc slug for type "doc"; href for type "link". */
  slug?: string;
  href?: string;
  /** Items under a client organizer carry its id; the TOC filters by it. */
  clientId?: string;
  /** Doc items targeting specific platforms (multiple `#tag:` markers); the TOC filters by the reader's platform. */
  platforms?: Platform[];
  children?: SidebarItem[];
}

export const SidebarItemSchema: z.ZodType<SidebarItem> = z.lazy(() =>
  z.object({
    type: z.enum(["group", "doc", "link", "toporg"]),
    id: z.string(),
    label: z.string(),
    slug: z.string().optional(),
    href: z.string().optional(),
    clientId: z.string().optional(),
    platforms: z.array(PlatformSchema).optional(),
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
