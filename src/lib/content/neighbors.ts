import type {
  Locale,
  LocaleManifest,
  ManifestPage,
  Platform,
  SidebarItem,
} from "@shared/content-schema";

/**
 * A collection's pages in reading order (hidden pages excluded). With a
 * platform, only that platform's pages plus platform-agnostic ones — the
 * reader swipes through everything for THIS platform, start to finish.
 */
export function readingOrder(
  manifest: LocaleManifest,
  collection: string,
  platform?: Platform,
): ManifestPage[] {
  return manifest.pages
    .filter(
      (p) =>
        p.collection === collection &&
        !p.hidden &&
        (!platform || !p.platform || p.platform === platform),
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
  platform?: Platform,
): PagePosition | undefined {
  const order = readingOrder(manifest, collection, platform);
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

/** Platform-tagged chapters from other platforms are hidden entirely. */
export function filterSidebarByPlatform(
  items: SidebarItem[],
  platform: Platform,
): SidebarItem[] {
  return items.filter((i) => !i.platform || i.platform === platform);
}
