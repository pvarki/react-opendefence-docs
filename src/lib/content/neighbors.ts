import type {
  ClientInfo,
  Locale,
  LocaleManifest,
  ManifestPage,
  Platform,
  SidebarItem,
} from "@shared/content-schema";
import { outlineUrlId } from "@shared/outline-url-id";
import { PLATFORM_LABELS, type ReadingView } from "@/lib/platform";

/**
 * The active client (selector entry) for a book: the remembered explicit
 * pick, else the first client matching the global platform, else the first
 * client. Books without clients return undefined (nothing to filter by).
 */
export function resolveClient(
  manifest: LocaleManifest,
  collection: string,
  view: ReadingView,
): ClientInfo | undefined {
  const clients = manifest.collections.find(
    (c) => c.slug === collection,
  )?.clients;
  if (!clients || clients.length === 0) return undefined;
  const overrideId = view.clientOverrides[collection];
  return (
    clients.find((c) => c.id === overrideId) ??
    clients.find((c) => c.platform === view.platform) ??
    clients[0]
  );
}

function pageMatchesView(
  page: ManifestPage,
  client: ClientInfo | undefined,
  view: ReadingView | undefined,
): boolean {
  if (!view) return true;
  if (page.clientId) return page.clientId === client?.id;
  // Client-less pages tagged with #tag:<platform> follow the global platform —
  // `platforms` (several tags) matches any listed OS, else the single `platform`.
  if (page.platforms?.length) return page.platforms.includes(view.platform);
  if (page.platform) return page.platform === view.platform;
  return true;
}

/**
 * A collection's pages in reading order. With a view, only the active
 * client's pages plus client-agnostic ones — the reader swipes through
 * everything for THIS view, start to finish.
 */
export function readingOrder(
  manifest: LocaleManifest,
  collection: string,
  view?: ReadingView,
): ManifestPage[] {
  const client = view ? resolveClient(manifest, collection, view) : undefined;
  return manifest.pages
    .filter(
      (p) => p.collection === collection && pageMatchesView(p, client, view),
    )
    .sort((a, b) => a.order - b.order);
}

export interface PagePosition {
  page: ManifestPage;
  prev?: ManifestPage;
  next?: ManifestPage;
  index: number;
  total: number;
}

/** Resolve a page and its swipe neighbors within its collection's book. */
export function resolvePosition(
  manifest: LocaleManifest,
  collection: string,
  slug: string,
  view?: ReadingView,
): PagePosition | undefined {
  const order = readingOrder(manifest, collection, view);
  const index = order.findIndex((p) => p.slug === slug);
  if (index === -1) return undefined;
  return {
    page: order[index],
    prev: order[index - 1],
    next: order[index + 1],
    index,
    total: order.length,
  };
}

/**
 * Every readable page of the app in one sequence — books in manifest order,
 * each in its platform-filtered reading order — with its swipe neighbours.
 * Neighbours cross book boundaries; index/total stay scoped to the page's own
 * book, so "Page n of N" and the progress bar describe the book while the
 * swipe continues past it.
 */
export function globalPositions(
  manifest: LocaleManifest,
  view?: ReadingView,
): PagePosition[] {
  const order = [...manifest.collections]
    .sort((a, b) => a.order - b.order)
    .flatMap((c) => readingOrder(manifest, c.slug, view));
  const totals = new Map<string, number>();
  for (const page of order) {
    totals.set(page.collection, (totals.get(page.collection) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return order.map((page, i) => {
    const index = seen.get(page.collection) ?? 0;
    seen.set(page.collection, index + 1);
    return {
      page,
      prev: order[i - 1],
      next: order[i + 1],
      index,
      total: totals.get(page.collection)!,
    };
  });
}

/**
 * Reader splat one step from a page, or undefined at either end of the app.
 * A forward step into another book lands on that book's cover, so the reader
 * can orient before diving in; a backward step goes straight to the page.
 */
export function stepSplat(
  position: PagePosition,
  dir: 1 | -1,
): string | undefined {
  const dest = dir === 1 ? position.next : position.prev;
  if (!dest) return undefined;
  return dir === 1 && dest.collection !== position.page.collection
    ? dest.collection
    : `${dest.collection}/${dest.slug}`;
}

/**
 * Resolve a reader splat ("deploy-app/welcome-x", "guides/tak-guide/foo-y",
 * "dev", "wikis/tak/bar-z") into collection + optional page slug. Collection
 * slugs can contain "/", so match longest collection prefix first.
 */
export function resolveSplat(
  manifest: LocaleManifest,
  splat: string,
): { collection: string; slug?: string } | undefined {
  const clean = splat.replace(/\/+$/, "");
  const collections = [...manifest.collections].sort(
    (a, b) => b.slug.length - a.slug.length,
  );
  for (const c of collections) {
    if (clean === c.slug) return { collection: c.slug };
    if (clean.startsWith(`${c.slug}/`)) {
      const rest = clean.slice(c.slug.length + 1);
      if (rest && !rest.includes("/"))
        return { collection: c.slug, slug: rest };
    }
  }
  return undefined;
}

/**
 * The page an outdated URL means: its last segment ends in the same Outline
 * urlId as a page in `manifest`. Page slugs are built from titles, so a rename
 * (or a move to another book) changes the slug while the urlId stays — old
 * links and bookmarks resolve here and are redirected to the page's URL.
 */
export function resolveByUrlId(
  manifest: LocaleManifest,
  splat: string,
): ManifestPage | undefined {
  const last = splat.replace(/\/+$/, "").split("/").pop() ?? "";
  const urlId = outlineUrlId(last);
  if (!urlId) return undefined;
  return manifest.pages.find((p) => outlineUrlId(p.slug) === urlId);
}

/** Title of Outline's "Platforms" wrapper organizer (META: platforms-container). */
const PLATFORMS_CONTAINER = "platforms";

/** Outline breadcrumb minus the Platforms wrapper and client organizers. */
export function readerBreadcrumb(
  manifest: LocaleManifest,
  page: ManifestPage,
): string[] {
  const clients =
    manifest.collections.find((c) => c.slug === page.collection)?.clients ?? [];
  const hidden = new Set<string>([
    ...clients.map((c) => c.label.toLowerCase()),
    ...Object.values(PLATFORM_LABELS).map((l) => l.toLowerCase()),
  ]);
  const ancestors = page.breadcrumb.slice(0, -1);
  const title = page.breadcrumb.at(-1) ?? page.title;
  return [
    ...ancestors.filter((part, i) => {
      const key = part.trim().toLowerCase();
      if (i === 0 && key === PLATFORMS_CONTAINER) return false;
      return !hidden.has(key);
    }),
    title,
  ];
}

export function pageRoute(locale: Locale, page: ManifestPage): string {
  return `/${locale}/${page.collection}/${page.slug}`;
}

/** Client-tagged sections from other clients are hidden entirely. */
export function filterSidebarByClient(
  items: SidebarItem[],
  clientId: string | undefined,
): SidebarItem[] {
  return items.filter((i) => !i.clientId || i.clientId === clientId);
}

/**
 * Hide doc items that target specific platforms not matching the reader's
 * platform (multi-`#tag:` pages, e.g. a desktop guide on a phone). Recurses,
 * dropping groups/toporgs left empty after filtering. Untagged items pass.
 */
export function filterSidebarByPlatform(
  items: SidebarItem[],
  platform: Platform,
): SidebarItem[] {
  const out: SidebarItem[] = [];
  for (const item of items) {
    if (
      item.type === "doc" &&
      item.platforms?.length &&
      !item.platforms.includes(platform)
    ) {
      continue;
    }
    if (item.children) {
      const children = filterSidebarByPlatform(item.children, platform);
      if (
        (item.type === "group" || item.type === "toporg") &&
        children.length === 0
      ) {
        continue;
      }
      out.push({ ...item, children });
    } else {
      out.push(item);
    }
  }
  return out;
}
