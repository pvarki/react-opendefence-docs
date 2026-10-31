/**
 * Cross-locale link localization.
 *
 * A link in a Finnish or Swedish page sometimes points to the English
 * version of a page, because the Outline author linked the English doc.
 * When the target page has a counterpart in the page's own locale (from the
 * Translations blocks, see translations.json), the link is rewritten to that
 * counterpart, so readers stay in their language. Links without a known
 * counterpart are left as they are (the validator still warns about them).
 */

import fs from "node:fs/promises";
import path from "node:path";

import {
  LOCALES,
  type Locale,
  type TranslationsFile,
} from "../../shared/content-schema";

export type TranslationsByLocale = ReadonlyMap<Locale, TranslationsFile>;

function parseLocaleRoute(
  route: string,
): { locale: Locale; slug: string } | undefined {
  const match = route.match(/^\/([a-z]{2})\/(?:.+\/)?([^/]+)\/?$/);
  if (!match) return undefined;
  const locale = LOCALES.find((l) => l === match[1]);
  return locale ? { locale, slug: match[2] } : undefined;
}

/**
 * The route of `route`'s counterpart in `locale`, or undefined when the
 * route is already in that locale or no counterpart is known.
 *
 * The target page's own Translations entry wins. Otherwise a page in
 * `locale` whose Translations entry points at `route` is used.
 */
export function counterpartRoute(
  route: string,
  locale: Locale,
  translations: TranslationsByLocale,
  slugRoutes: ReadonlyMap<string, string>,
): string | undefined {
  const target = parseLocaleRoute(route);
  if (!target || target.locale === locale) return undefined;

  const own = translations.get(target.locale)?.[target.slug]?.[locale];
  if (own) return own;

  for (const [slug, targets] of Object.entries(
    translations.get(locale) ?? {},
  )) {
    if (targets[target.locale] === route) {
      return targets[locale] ?? slugRoutes.get(slug);
    }
  }
  return undefined;
}

const HREF = /href="(\/[a-z]{2}\/[^"#?]+)([#?][^"]*)?"/g;

/**
 * Rewrite cross-locale hrefs in an HTML string. A fragment is dropped on
 * rewrite: it names a heading of the other language's page.
 */
export function localizeHrefs(
  html: string,
  locale: Locale,
  translations: TranslationsByLocale,
  slugRoutes: ReadonlyMap<string, string>,
): { html: string; count: number } {
  let count = 0;
  const out = html.replace(HREF, (whole, route: string) => {
    const counterpart = counterpartRoute(
      route,
      locale,
      translations,
      slugRoutes,
    );
    if (!counterpart) return whole;
    count++;
    return `href="${counterpart}"`;
  });
  return { html: out, count };
}

/** Apply localizeHrefs to every string inside a JSON value. */
export function localizeHrefsDeep(
  value: unknown,
  locale: Locale,
  translations: TranslationsByLocale,
  slugRoutes: ReadonlyMap<string, string>,
): { value: unknown; count: number } {
  let count = 0;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      if (!v.includes('href="/')) return v;
      const result = localizeHrefs(v, locale, translations, slugRoutes);
      count += result.count;
      return result.html;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v).map(([k, child]) => [k, walk(child)]),
      );
    }
    return v;
  };
  return { value: walk(value), count };
}

/**
 * Localize cross-locale links in every page file under `dir` (one book of
 * one locale). Only files that change are rewritten. Returns the number of
 * links rewritten.
 */
export async function localizeBookPages(
  dir: string,
  locale: Locale,
  translations: TranslationsByLocale,
  slugRoutes: ReadonlyMap<string, string>,
): Promise<number> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let total = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(dir, entry.name);
    const page: unknown = JSON.parse(await fs.readFile(file, "utf-8"));
    const { value, count } = localizeHrefsDeep(
      page,
      locale,
      translations,
      slugRoutes,
    );
    if (count === 0) continue;
    await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
    total += count;
  }
  return total;
}
