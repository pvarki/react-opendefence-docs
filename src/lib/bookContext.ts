import { useMatches } from "@tanstack/react-router";
import type { Locale, LocaleManifest } from "@shared/content-schema";

/** What shell chrome needs to know about the book on screen. */
export interface BookContext {
  manifest: LocaleManifest;
  /** Locale the content actually comes from (en when falling back). */
  contentLocale: Locale;
  collection: string;
  slug?: string;
}

const BOOK_ROUTES = ["/$locale/$", "/$locale/dev/$book/$view"];

/** The active book, whether it is being read or its reference is open. */
export function useBookContext(): BookContext | undefined {
  const matches = useMatches();
  const match = matches.find((m) => BOOK_ROUTES.includes(m.routeId));
  return match?.loaderData as BookContext | undefined;
}
