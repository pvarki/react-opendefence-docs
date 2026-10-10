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
    },
  ];
  return sections.filter((s) => s.books.length > 0);
}

export interface ParentShelf {
  to: "/$locale" | "/$locale/guides" | "/$locale/advanced" | "/$locale/dev";
  labelKey: string;
}

/** Deploy App is the lead book, so its back link goes Home, not to Guides. */
export function parentShelf(
  section: ManifestCollection["section"] | undefined,
): ParentShelf {
  switch (section) {
    case "deploy-app":
      return { to: "/$locale", labelKey: "nav.home" };
    case "wikis":
      return { to: "/$locale/advanced", labelKey: "nav.advanced" };
    case "dev":
      return { to: "/$locale/dev", labelKey: "nav.develop" };
    default:
      return { to: "/$locale/guides", labelKey: "sidebar.allGuides" };
  }
}
