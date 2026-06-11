/**
 * Sidebar / book builder.
 *
 * Turns an Outline collection's nav tree (one locale root's children) into
 * the app-facing SidebarConfig plus a flattened reading order that drives
 * swipe navigation and manifest `order`.
 *
 * Structure model (mirrors how authors organize guides in Outline):
 *
 *   locale root
 *   ├── Platform organizer (Android / iOS / ... or client names: ATAK/iTAK/WinTAK)
 *   │   ├── Chapter organizer (User Guide, Admin Guide, Troubleshooting, ...)
 *   │   │   ├── content page
 *   │   │   └── content page (deeper nesting flattens into the chapter)
 *   │   └── content page          (chapterless: grouped under the platform label)
 *   ├── Chapter organizer          (platform-agnostic chapter, shown everywhere)
 *   │   └── content page
 *   └── content page               (top-level platform-agnostic page)
 *
 * THE RULE: organizer docs (docs WITH children) are navigation, never pages.
 * Only leaf docs enter the reading order. Platform organizer bodies are still
 * fetched by sync to detect the under-development marker for the selector tag.
 */
import {
  SCHEMA_VERSION,
  type Locale,
  type Platform,
  type SidebarConfig,
  type SidebarItem,
} from "../../shared/content-schema";
import type { CollectionConfig } from "../../config/collections";
import { stripEmojis } from "./outline-normalizer";
import type { OutlineNavNode } from "./script-types";

// Re-exported so buildBook callers don't need a second import site.
export type { OutlineNavNode } from "./script-types";

export type PagePlatform = Platform;

export interface BookPageRef {
  docId: string;
  /** Outline url slug incl. shortid suffix (last URL segment). */
  slug: string;
  title: string;
  breadcrumb: string[];
  /** From the enclosing platform organizer or a "#tag:..." title marker. */
  platform?: Platform;
  chapterId?: string;
  chapterLabel?: string;
}

export interface BookPlatformRef {
  key: Platform;
  /** Display label from the organizer title (e.g. "ATAK" for android). */
  label: string;
  /** Organizer doc id — sync fetches its body for the under-dev marker. */
  docId: string;
}

export interface BookBuild {
  sidebar: SidebarConfig;
  readingOrder: BookPageRef[];
  platforms: BookPlatformRef[];
}

/** Last URL segment = full Outline slug (shortid suffix kept). */
export function slugFromUrl(url: string): string {
  return url.slice(url.lastIndexOf("/") + 1);
}

/**
 * Sidebar label cleanup, ported from the old wiki's cleanLabel (regexes kept
 * byte-identical — they encode years of Outline title quirks): surrounding
 * brackets, "#tag:..." markers and trailing parentheticals are authoring
 * metadata, not part of the visible label.
 */
export function cleanLabel(label: string): string {
  return stripEmojis(
    label
      .replace(/^\[/, "") // Remove leading bracket
      .replace(/\]$/, "") // Remove trailing bracket
      .replace(/\s*#tag:\S+/g, "") // Remove #tag:... markers
      .replace(/\s*\([^)]*\)\s*$/, ""), // Remove trailing parenthetical
  );
}

/**
 * Platform detection for organizer titles. Exact client names map onto their
 * platform (ported concept from the old wiki's platform-filter label map:
 * "atak" -> android etc.); otherwise any platform word in the title decides
 * ("TAK Tracker - Android" -> android, "TAK Tracker - Apple" -> ios).
 */
const PLATFORM_NAMES: Record<string, Platform> = {
  android: "android",
  atak: "android",
  ios: "ios",
  iphone: "ios",
  ipados: "ios",
  itak: "ios",
  windows: "windows",
  wintak: "windows",
  linux: "linux",
  macos: "macos",
  mac: "macos",
  "mac os": "macos",
};

const PLATFORM_TOKENS: Record<string, Platform> = {
  android: "android",
  ios: "ios",
  iphone: "ios",
  ipad: "ios",
  apple: "ios",
  windows: "windows",
  linux: "linux",
  macos: "macos",
};

export function detectPlatform(title: string): Platform | undefined {
  const cleaned = cleanLabel(title).trim().toLowerCase();
  const exact = PLATFORM_NAMES[cleaned];
  if (exact) return exact;
  for (const token of cleaned.split(/[^a-z]+/)) {
    const byToken = PLATFORM_TOKENS[token];
    if (byToken) return byToken;
  }
  return platformFromTitle(title);
}

/** Extract the platform chip tag from a raw Outline title, if present. */
export function platformFromTitle(title: string): Platform | undefined {
  const match = title.match(/#tag:(android|ios|windows|linux|macos)\b/i);
  return match ? (match[1].toLowerCase() as Platform) : undefined;
}

/**
 * Page title / breadcrumb cleanup: emojis and "#tag:..." markers go (the tag
 * becomes the structured `platform` field instead); unlike sidebar labels,
 * trailing parentheticals are kept — they are part of the page title.
 */
export function cleanTitle(title: string): string {
  return stripEmojis(title.replace(/\s*#tag:\S+/g, ""));
}

function makeDocItem(node: OutlineNavNode): SidebarItem {
  const slug = slugFromUrl(node.url);
  return { type: "doc", id: slug, label: cleanLabel(node.title), slug };
}

interface ChapterContext {
  platform?: Platform;
  chapterId?: string;
  chapterLabel?: string;
}

function makePageRef(
  node: OutlineNavNode,
  trailTitles: string[],
  ctx: ChapterContext,
): BookPageRef {
  const platform = platformFromTitle(node.title) ?? ctx.platform;
  return {
    docId: node.id,
    slug: slugFromUrl(node.url),
    title: cleanTitle(node.title),
    breadcrumb: trailTitles.map((t) => cleanTitle(t)),
    ...(platform ? { platform } : {}),
    ...(ctx.chapterId
      ? { chapterId: ctx.chapterId, chapterLabel: ctx.chapterLabel }
      : {}),
  };
}

/**
 * Build the sidebar and flattened reading order for one collection x locale.
 *
 * `localeRootChildren` are the children of the locale root doc (or of the
 * synthetic root for noLocale collections) — the locale wrapper itself is
 * not a page.
 */
export function buildBook(
  localeRootChildren: OutlineNavNode[],
  collection: CollectionConfig,
  _locale: Locale,
): BookBuild {
  const items: SidebarItem[] = [];
  const readingOrder: BookPageRef[] = [];
  const platforms: BookPlatformRef[] = [];

  // First pass: count client organizers per platform (across one wrapper
  // level, e.g. "TAK Clients" -> ATAK + TAK Tracker are both android). When
  // a platform has several clients, chapter labels get the client prefix so
  // the bottom bar's chips stay unambiguous ("ATAK · Start").
  const clientCounts = new Map<Platform, number>();
  const countClients = (nodes: OutlineNavNode[]) => {
    for (const node of nodes) {
      if (node.children.length === 0) continue;
      const platform = detectPlatform(node.title);
      if (platform) {
        clientCounts.set(platform, (clientCounts.get(platform) ?? 0) + 1);
      } else if (
        node.children.some(
          (c) => c.children.length > 0 && detectPlatform(c.title),
        )
      ) {
        countClients(node.children);
      }
    }
  };
  countClients(localeRootChildren);

  // All leaf descendants of `node`, depth-first, flattened into one chapter.
  const collectLeaves = (
    node: OutlineNavNode,
    trailTitles: string[],
    ctx: ChapterContext,
    groupChildren: SidebarItem[],
  ): void => {
    for (const child of node.children) {
      const trail = [...trailTitles, child.title];
      if (child.children.length === 0) {
        readingOrder.push(makePageRef(child, trail, ctx));
        groupChildren.push(makeDocItem(child));
      } else {
        // Sub-organizers below chapter level flatten into the chapter.
        collectLeaves(child, trail, ctx, groupChildren);
      }
    }
  };

  // One chapter organizer -> one sidebar group + its pages in reading order.
  const addChapter = (
    node: OutlineNavNode,
    trailTitles: string[],
    platform: Platform | undefined,
    labelPrefix?: string,
  ): void => {
    const label = cleanLabel(node.title);
    const ctx: ChapterContext = {
      platform,
      chapterId: slugFromUrl(node.url),
      chapterLabel: labelPrefix ? `${labelPrefix} · ${label}` : label,
    };
    const groupChildren: SidebarItem[] = [];
    collectLeaves(node, trailTitles, ctx, groupChildren);
    if (groupChildren.length === 0) return; // empty organizer: nothing to show
    items.push({
      type: "group",
      id: ctx.chapterId!,
      label: ctx.chapterLabel!,
      ...(platform ? { platform } : {}),
      children: groupChildren,
    });
  };

  // A platform/client organizer: its sub-organizers are chapters, its direct
  // leaves group under the client's own label.
  const addClient = (
    node: OutlineNavNode,
    trailTitles: string[],
    platform: Platform,
  ) => {
    const clientLabel = cleanLabel(node.title);
    platforms.push({ key: platform, label: clientLabel, docId: node.id });
    const prefix =
      (clientCounts.get(platform) ?? 0) > 1 ? clientLabel : undefined;

    const looseCtx: ChapterContext = {
      platform,
      chapterId: slugFromUrl(node.url),
      chapterLabel: clientLabel,
    };
    const looseChildren: SidebarItem[] = [];
    for (const sub of node.children) {
      const trail = [...trailTitles, sub.title];
      if (sub.children.length === 0) {
        readingOrder.push(makePageRef(sub, trail, looseCtx));
        looseChildren.push(makeDocItem(sub));
      } else {
        addChapter(sub, trail, platform, prefix);
      }
    }
    if (looseChildren.length > 0) {
      items.push({
        type: "group",
        id: looseCtx.chapterId!,
        label: looseCtx.chapterLabel!,
        platform,
        children: looseChildren,
      });
    }
  };

  // A "root-like" level: locale root children, or the children of a wrapper
  // organizer that exists only to hold platform clients (e.g. "TAK Clients").
  const walkRootLevel = (nodes: OutlineNavNode[], trailTitles: string[]) => {
    for (const child of nodes) {
      const trail = [...trailTitles, child.title];

      // Top-level leaf: a platform-agnostic content page.
      if (child.children.length === 0) {
        readingOrder.push(makePageRef(child, trail, {}));
        items.push(makeDocItem(child));
        continue;
      }

      const platform = detectPlatform(child.title);
      if (platform) {
        addClient(child, trail, platform);
        continue;
      }

      const wrapsClients = child.children.some(
        (c) => c.children.length > 0 && detectPlatform(c.title),
      );
      if (wrapsClients) {
        walkRootLevel(child.children, trail);
      } else {
        // Platform-agnostic chapter (e.g. Troubleshooting, wiki sections).
        addChapter(child, trail, undefined);
      }
    }
  };

  walkRootLevel(localeRootChildren, []);

  // The selector shows one entry per platform key; the first client names it
  // (ATAK for android in the TAK guide). Sync ORs under-dev flags per key.
  return {
    sidebar: {
      schemaVersion: SCHEMA_VERSION,
      label: collection.label,
      slug: collection.slug,
      items,
    },
    readingOrder,
    platforms,
  };
}
