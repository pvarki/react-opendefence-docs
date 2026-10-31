import type { TFunction } from "i18next";
import type { ManifestCollection } from "@shared/content-schema";

/**
 * A book's one-line description in the UI language. config/collections.ts
 * holds the English text (synced into every locale's manifest); locale files
 * override it under `bookDescriptions.<slug>` ("/" in the slug nests).
 */
export function bookDescription(
  t: TFunction,
  book: Pick<ManifestCollection, "slug" | "description">,
): string | undefined {
  if (!book.description) return undefined;
  return t(`bookDescriptions.${book.slug.replaceAll("/", ".")}`, {
    defaultValue: book.description,
  });
}
