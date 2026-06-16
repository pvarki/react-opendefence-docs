import type {
  ClientInfo,
  Locale,
  LocaleManifest,
  ManifestPage,
  Platform,
  SidebarItem,
} from "@shared/content-schema";
import type { ReadingView } from "@/lib/platform";

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
 * A collection's pages in reading order (hidden pages excluded). With a
 * view, only the active client's pages plus client-agnostic ones — the
 * reader swipes through everything for THIS view, start to finish.
 */
export function readingOrder(
  manifest: LocaleManifest,
  collection: string,
  view?: ReadingView,
): ManifestPage[] {
  const client = view ? resolveClient(manifest, collection, view) : undefined;
  return manifest.pages
    .filter(
      (p) =>
        p.collection === collection &&
        !p.hidden &&
        pageMatchesView(p, client, view),
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
 * Every readable page of the app in one sequence: books in manifest order,
 * each in its platform-filtered reading order — the whole app is swipable
 * start to finish.
 */
export function globalReadingOrder(
  manifest: LocaleManifest,
  view?: ReadingView,
): ManifestPage[] {
  return [...manifest.collections]
    .sort((a, b) => a.order - b.order)
    .flatMap((c) => readingOrder(manifest, c.slug, view));
}

/**
 * A page's swipe neighbors in the GLOBAL order (crossing book boundaries),
 * with index/total still scoped to its own book — "Page n of N" and the
 * progress bar describe the book, the swipe continues past it.
 */
export function resolveGlobalPosition(
  manifest: LocaleManifest,
  collection: string,
  slug: string,
  view?: ReadingView,
): PagePosition | undefined {
  const global = globalReadingOrder(manifest, view);
  const gi = global.findIndex(
    (p) => p.collection === collection && p.slug === slug,
  );
  if (gi === -1) return undefined;
  const book = readingOrder(manifest, collection, view);
  const bi = book.findIndex((p) => p.slug === slug);
  return {
    page: global[gi],
    prev: global[gi - 1],
    next: global[gi + 1],
    index: bi,
    total: book.length,
  };
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
