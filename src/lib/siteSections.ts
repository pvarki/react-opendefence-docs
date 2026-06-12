import type {
  LocaleManifest,
  ManifestCollection,
} from "@shared/content-schema";

export interface SiteSection {
  /** i18n key for the toporg-style heading. */
  titleKey: string;
  books: ManifestCollection[];
  /** Append the API Reference entry (Developer section). */
  withApiReference?: boolean;
}

/**
 * The unified Guides layout: every book in the app grouped under
 * toporg-style sections. Used by the Guides page and the site-wide
 * Contents sheet so both always agree.
 */
export function siteSections(manifest: LocaleManifest): SiteSection[] {
  const bySection = (key: ManifestCollection["section"]) =>
    manifest.collections.filter((c) => c.section === key);
  return [
    { titleKey: "nav.deployApp", books: bySection("deploy-app") },
    { titleKey: "sections.products", books: bySection("guides") },
    { titleKey: "nav.advanced", books: bySection("wikis") },
    {
      titleKey: "sections.developer",
      books: bySection("dev"),
      withApiReference: true,
    },
  ].filter((s) => s.books.length > 0 || s.withApiReference);
}
