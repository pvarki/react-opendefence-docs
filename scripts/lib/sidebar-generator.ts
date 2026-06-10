/**
 * Sidebar / book builder.
 *
 * Turns an Outline collection's nav tree (one locale root's children) into
 * the app-facing SidebarConfig plus a flattened reading order that drives
 * swipe navigation and manifest `order`.
 *
 * Flattening rule (the sidebar shows at most two levels):
 * - depth-1 nodes WITH children become "group" items; the depth-1 doc itself
 *   becomes the group's first "doc" child (its body is a real page).
 * - depth-1 leaves become top-level "doc" items.
 * - depth >= 2 nodes are flattened depth-first into the nearest depth-1
 *   ancestor's group children; their breadcrumb keeps the full original path
 *   labels so the deeper structure remains visible on the page itself.
 *
 * readingOrder is the depth-first pre-order of all doc items. Hidden /
 * under-development pages are NOT filtered here — sync marks them in the
 * manifest and the app filters.
 */
import {
  SCHEMA_VERSION,
  type Locale,
  type SidebarConfig,
  type SidebarItem,
} from "../../shared/content-schema";
import type { CollectionConfig } from "../../config/collections";
import { stripEmojis } from "./outline-normalizer";
import type { OutlineNavNode } from "./script-types";

// Re-exported so buildBook callers don't need a second import site.
export type { OutlineNavNode } from "./script-types";

export type PagePlatform = "android" | "ios" | "windows";

export interface BookPageRef {
  docId: string;
  /** Outline url slug incl. shortid suffix (last URL segment). */
  slug: string;
  title: string;
  breadcrumb: string[];
  /** Parsed from a "#tag:android|ios|windows" marker in the Outline title. */
  platform?: PagePlatform;
}

export interface BookBuild {
  sidebar: SidebarConfig;
  readingOrder: BookPageRef[];
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

/** Extract the platform chip tag from a raw Outline title, if present. */
export function platformFromTitle(title: string): PagePlatform | undefined {
  const match = title.match(/#tag:(android|ios|windows)\b/i);
  return match ? (match[1].toLowerCase() as PagePlatform) : undefined;
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

function makePageRef(node: OutlineNavNode, trailTitles: string[]): BookPageRef {
  const platform = platformFromTitle(node.title);
  return {
    docId: node.id,
    slug: slugFromUrl(node.url),
    title: cleanTitle(node.title),
    breadcrumb: trailTitles.map((t) => cleanTitle(t)),
    ...(platform ? { platform } : {}),
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

  // Depth-first flatten of all descendants (depth >= 2) into one group's
  // doc children, breadcrumbs keeping the full original path.
  const flattenInto = (
    node: OutlineNavNode,
    trailTitles: string[],
    groupChildren: SidebarItem[],
  ): void => {
    for (const child of node.children) {
      const trail = [...trailTitles, child.title];
      readingOrder.push(makePageRef(child, trail));
      groupChildren.push(makeDocItem(child));
      flattenInto(child, trail, groupChildren);
    }
  };

  for (const child of localeRootChildren) {
    readingOrder.push(makePageRef(child, [child.title]));

    if (child.children.length === 0) {
      items.push(makeDocItem(child));
      continue;
    }

    // The depth-1 doc itself is the group's first doc child.
    const groupChildren: SidebarItem[] = [makeDocItem(child)];
    flattenInto(child, [child.title], groupChildren);
    items.push({
      type: "group",
      id: slugFromUrl(child.url),
      label: cleanLabel(child.title),
      children: groupChildren,
    });
  }

  return {
    sidebar: {
      schemaVersion: SCHEMA_VERSION,
      label: collection.label,
      slug: collection.slug,
      items,
    },
    readingOrder,
  };
}
