import type {
  LocaleManifest,
  ManifestCollection,
} from "@shared/content-schema";

export interface SiteSection {
  /** i18n key for the toporg-style heading. */
  titleKey: string;
  /** Which shelf page lists this section. */
  shelf: "guides" | "advanced" | "developer";
  books: ManifestCollection[];
  /** Append the API Reference entry (Developer section). */
  withApiReference?: boolean;
  /** Append the Releases entry (Developer section). */
  withReleases?: boolean;
}

/**
 * Every book in the app grouped under toporg-style sections, tagged with
 * the shelf page that owns it. The Guides page shows the "guides" shelf
 * (Deploy App + Products); Advanced and Developer have their own pages;
 * the site-wide Contents sheet shows everything.
 */
export function siteSections(manifest: LocaleManifest): SiteSection[] {
  const bySection = (key: ManifestCollection["section"]) =>
    manifest.collections.filter((c) => c.section === key);
  const sections: SiteSection[] = [
    {
      titleKey: "nav.deployApp",
      shelf: "guides",
      books: bySection("deploy-app"),
    },
    {
      titleKey: "sections.products",
      shelf: "guides",
      books: bySection("guides"),
    },
    { titleKey: "nav.advanced", shelf: "advanced", books: bySection("wikis") },
    {
      titleKey: "sections.developer",
      shelf: "developer",
      books: bySection("dev"),
      withApiReference: true,
      withReleases: true,
    },
  ];
  return sections.filter(
    (s) => s.books.length > 0 || s.withApiReference || s.withReleases,
  );
}
