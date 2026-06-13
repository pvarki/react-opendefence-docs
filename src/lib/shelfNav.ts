/**
 * The "bookshelf-level" landing pages, in swipe order. Swiping (or arrow
 * keys / wheel) on any of these moves to the adjacent one — Home ⇄ Deploy
 * App ⇄ Guides ⇄ Advanced ⇄ Develop — a separate gesture from the in-book
 * reader, which swipes chapter-by-chapter across the whole app.
 *
 * Deploy App is the deploy-app book *cover* (served by the `/$locale/$`
 * reader route); the other four are dedicated shelf/home routes. Only the
 * cover — not deploy-app's content pages — is a stop, so reading the book
 * still hands off to the reader's chapter swipe.
 */
export type ShelfStopId = "home" | "deploy-app" | "guides" | "advanced" | "dev";

export interface ShelfStop {
  id: ShelfStopId;
  /** Path after the locale segment, base- and slash-free. "" is Home. */
  path: string;
}

export const SHELF_STOPS: ShelfStop[] = [
  { id: "home", path: "" },
  { id: "deploy-app", path: "deploy-app" },
  { id: "guides", path: "guides" },
  { id: "advanced", path: "advanced" },
  { id: "dev", path: "dev" },
];

/**
 * Index of the landing stop the pathname is *exactly* on, or -1 elsewhere
 * (incl. content pages like /deploy-app/foo or /dev/api, which keep the
 * reader's own swipe). `pathname` must already be base-stripped.
 */
export function shelfStopIndex(pathname: string, locale: string): number {
  const clean = pathname.replace(/\/+$/, "");
  const prefix = `/${locale}`;
  if (clean === prefix) return 0; // Home (path "")
  if (!clean.startsWith(`${prefix}/`)) return -1;
  const rest = clean.slice(prefix.length + 1);
  return SHELF_STOPS.findIndex((s) => s.path !== "" && s.path === rest);
}
