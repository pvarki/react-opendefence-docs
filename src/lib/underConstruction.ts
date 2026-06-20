import type { ManifestPage, Platform } from "@shared/content-schema";

/**
 * Views flagged "under construction" — a non-blocking banner renders above the
 * content (the page still shows). Matching is by the fields every ManifestPage
 * already carries, so a scope cascades to every descendant automatically:
 *   - { collection }                  → the whole book + all its pages
 *   - { collection, platform }        → only that platform's pages in the book
 *   - { collection, chapterIds }      → only those chapters' pages
 * Edit this list to flag/unflag views — no content re-sync needed.
 */
interface Scope {
  /** Collection slug, e.g. "deploy-app" or "guides/tak-guide". */
  collection: string;
  /** OS platform — matches page.platform or any of page.platforms. */
  platform?: Platform;
  /** Outline chapter (organizer) ids — matches page.chapterId. */
  chapterIds?: string[];
}

const SCOPES: Scope[] = [
  // Deploy App — Windows guide (its pages only; Android/iOS are unaffected).
  { collection: "deploy-app", platform: "windows" },
  // Power-user wikis — the whole books and everything in them.
  { collection: "wikis/tak" },
  { collection: "wikis/mtx" },
  // TAK plugin guides — the SUPPORTED PLUGINS chapters (ATAK + WinTAK).
  // ponytail: chapters listed by id; if a SUPPORTED PLUGINS toporg gains a
  // chapter, add its chapterId here.
  {
    collection: "guides/tak-guide",
    chapterIds: [
      "uas-tool-7Z75EajOUb", // ATAK
      "grg-builder-JjwvXFR6na",
      "reports-6HdrUSYmw9",
      "connect-radio-with-hammer-vdPW7IvJlG",
      "tak-replay-GSHD19ipyT", // WinTAK
      "grg-builder-Hoz96EesTm",
      "reports-kTDOW67c8w",
      "vns-vehicle-navigation-system-AiQdKUTeFM",
    ],
  },
];

function pagePlatforms(
  page: Pick<ManifestPage, "platform" | "platforms">,
): Platform[] {
  if (page.platforms?.length) return page.platforms;
  return page.platform ? [page.platform] : [];
}

/** A page is under construction if it falls within any flagged scope. */
export function isPageUnderConstruction(
  page: Pick<
    ManifestPage,
    "collection" | "platform" | "platforms" | "chapterId"
  >,
): boolean {
  return SCOPES.some(
    (s) =>
      s.collection === page.collection &&
      (!s.platform || pagePlatforms(page).includes(s.platform)) &&
      (!s.chapterIds ||
        (page.chapterId ? s.chapterIds.includes(page.chapterId) : false)),
  );
}

/**
 * The book cover represents the whole book, so chapter-scoped flags don't
 * apply to it. A platform-scoped flag shows on the cover only when that
 * platform is the active view.
 */
export function isCoverUnderConstruction(
  collection: string,
  activePlatform?: Platform,
): boolean {
  return SCOPES.some(
    (s) =>
      s.collection === collection &&
      !s.chapterIds &&
      (!s.platform || s.platform === activePlatform),
  );
}
