import { Fragment, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Braces, ChevronRight, Code2, Compass } from "lucide-react";
import type { ManifestCollection } from "@shared/content-schema";
import { BookCard } from "@/components/shell/BookCard";
import { OrientationModal } from "@/components/shell/OrientationModal";
import { orientationSeen, markOrientationSeen } from "@/lib/orientationFlows";
import { AgentFriendlyNote } from "@/components/shell/AgentFriendlyNote";
import { ShelfHero } from "@/components/shell/ShelfHero";
import { CARD_IMAGES } from "@/lib/cardImages";
import { withBase } from "@/lib/base";
import { loadManifest } from "@/lib/content/loader";
import { readingOrder } from "@/lib/content/neighbors";
import { siteSections } from "@/lib/siteSections";

// A book whose slug equals a shelf route segment (e.g. "dev") would link onto
// the shelf itself; those link to their first page instead of the cover.
const RESERVED_SLUGS = new Set(["dev", "guides", "advanced"]);

// Toporg-style grouping of the Develop shelf (separate from the manifest order).
const GROUPS: { headingKey: string; slugs: string[] }[] = [
  { headingKey: "devShelf.introduction", slugs: ["introduction"] },
  { headingKey: "devShelf.operate", slugs: ["operate"] },
  {
    headingKey: "devShelf.contribute",
    slugs: ["contribute-to-project", "develop-deploy-app"],
  },
  { headingKey: "devShelf.integrate", slugs: ["build-an-integration"] },
];

export interface RelComponent {
  id: string;
  name: string;
  hasReleases: boolean;
  hasChangelog: boolean;
}

// "Working with TAK" — three deep-link tabs into the single working-with-tak
// collection. Each card links to that guide chapter's first page.
const TAK_COLLECTION = "working-with-tak";
const TAK_CHAPTERS: { titleKey: string; descKey: string; chapter: string }[] = [
  {
    titleKey: "takShelf.pluginDevTitle",
    descKey: "takShelf.pluginDevDesc",
    chapter: "ATAK Plugin Development",
  },
  {
    titleKey: "takShelf.integratingTitle",
    descKey: "takShelf.integratingDesc",
    chapter: "Integrating to TAK Server",
  },
  {
    titleKey: "takShelf.federationTitle",
    descKey: "takShelf.federationDesc",
    chapter: "Federation Hub: connecting multiple TAK Servers",
  },
];
export interface TakTab {
  titleKey: string;
  descKey: string;
  splat: string;
}

export const Route = createFileRoute("/$locale/dev/")({
  loader: async ({ context }) => {
    const manifest = await loadManifest(context.locale);
    const section = siteSections(manifest).find((s) => s.shelf === "developer");
    const books = section?.books ?? [];
    const firstPages: Record<string, string | undefined> = {};
    for (const b of books)
      firstPages[b.slug] = readingOrder(manifest, b.slug)[0]?.slug;

    let relComponents: RelComponent[] = [];
    try {
      const res = await fetch(withBase("/release-docs/manifest.json"));
      if (res.ok) {
        const m = (await res.json()) as {
          components?: {
            id: string;
            name: string;
            releases?: unknown[];
            changelogFile?: string;
          }[];
        };
        relComponents = (m.components ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          hasReleases: (c.releases?.length ?? 0) > 0,
          hasChangelog: !!c.changelogFile,
        }));
      }
    } catch {
      // release docs are optional; the shelf still renders
    }

    const takTabs = TAK_CHAPTERS.map((c): TakTab | null => {
      const first = manifest.pages
        .filter(
          (p) =>
            p.collection === TAK_COLLECTION &&
            p.chapterLabel === c.chapter &&
            !p.hidden,
        )
        .sort((a, b) => a.order - b.order)[0];
      return first
        ? {
            titleKey: c.titleKey,
            descKey: c.descKey,
            splat: `${TAK_COLLECTION}/${first.slug}`,
          }
        : null;
    }).filter((t): t is TakTab => t !== null);

    return { books, firstPages, relComponents, takTabs };
  },
  component: DevShelf,
});

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-1 pt-6 pb-2 text-[11px] font-semibold tracking-widest text-primary uppercase">
      {children}
    </h2>
  );
}

function ComponentRow({
  locale,
  comp,
  tab,
  available,
}: {
  locale: string;
  comp: RelComponent;
  tab: "releases" | "changelog";
  available: boolean;
}) {
  const { t } = useTranslation();
  if (!available) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 px-3.5 py-2.5 text-sm text-muted-foreground md:px-4">
        <span className="truncate">{comp.name}</span>
        <span className="ml-2 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          {t("releases.underDevelopment")}
        </span>
      </div>
    );
  }
  return (
    <Link
      to="/$locale/dev/releases"
      params={{ locale }}
      search={{ c: comp.id, tab }}
      className="group flex items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:px-4"
    >
      <span className="truncate font-medium">{comp.name}</span>
      <ChevronRight className="ml-2 size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function DevShelf() {
  const { t } = useTranslation();
  const { locale } = Route.useParams();
  const { books, firstPages, relComponents, takTabs } = Route.useLoaderData();
  // Auto-open the orientation flow once per visitor (lazy init, like IntroModal).
  const [orientOpen, setOrientOpen] = useState(() => !orientationSeen());

  const bookCard = (book: ManifestCollection) => {
    const first = firstPages[book.slug];
    const splat =
      RESERVED_SLUGS.has(book.slug) && first
        ? `${book.slug}/${first}`
        : book.slug;
    return (
      <BookCard
        key={book.slug}
        locale={locale}
        to="/$locale/$"
        splat={splat}
        icon={Code2}
        title={book.label}
        description={book.description}
        image={CARD_IMAGES[book.slug]}
      />
    );
  };

  return (
    <div className="h-full overflow-y-auto">
      <ShelfHero
        src="/images/develop.jpeg"
        title={t("nav.develop")}
        position="object-[center_80%]"
      />
      <div className="mx-auto max-w-3xl px-4 py-4 md:py-8">
        <p className="text-sm leading-relaxed text-foreground">
          {t("devFooter.leadBefore")}
          <strong className="font-semibold text-primary">
            {t("devFooter.leadEmphasis")}
          </strong>
          {t("devFooter.leadAfter")}
        </p>
        <button
          type="button"
          onClick={() => setOrientOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Compass className="size-3.5 text-primary" />
          {t("orient.revisit")}
        </button>
        {GROUPS.map((g) => {
          const groupBooks = g.slugs
            .map((s) => books.find((b) => b.slug === s))
            .filter((b): b is ManifestCollection => Boolean(b));
          if (groupBooks.length === 0) return null;
          return (
            <Fragment key={g.headingKey}>
              <SectionHeading>{t(g.headingKey)}</SectionHeading>
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
                {groupBooks.map(bookCard)}
              </div>
            </Fragment>
          );
        })}

        <SectionHeading>{t("releases.sectionTitle")}</SectionHeading>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
          <BookCard
            locale={locale}
            to="/$locale/dev/api"
            icon={Braces}
            title={t("apiRef.title")}
            description={t("apiRef.descDev")}
          />
        </div>

        {relComponents.length > 0 && (
          <>
            <h3 className="px-1 pt-4 pb-1.5 text-xs font-semibold text-foreground">
              {t("releases.title")}
            </h3>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {relComponents.map((c) => (
                <ComponentRow
                  key={c.id}
                  locale={locale}
                  comp={c}
                  tab="releases"
                  available={c.hasReleases}
                />
              ))}
            </div>

            <h3 className="px-1 pt-4 pb-1.5 text-xs font-semibold text-foreground">
              {t("releases.changelogs")}
            </h3>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {relComponents.map((c) => (
                <ComponentRow
                  key={c.id}
                  locale={locale}
                  comp={c}
                  tab="changelog"
                  available={c.hasChangelog}
                />
              ))}
            </div>
          </>
        )}

        {takTabs.length > 0 && (
          <>
            <SectionHeading>{t("devShelf.workingWithTak")}</SectionHeading>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
              {takTabs.map((tab) => (
                <BookCard
                  key={tab.splat}
                  locale={locale}
                  to="/$locale/$"
                  splat={tab.splat}
                  icon={Code2}
                  title={t(tab.titleKey)}
                  description={t(tab.descKey)}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <DevFooter />
      <OrientationModal
        open={orientOpen}
        start="selector"
        onOpenChange={(o) => {
          setOrientOpen(o);
          if (!o) markOrientationSeen();
        }}
      />
    </div>
  );
}

/** Develop-page foot: the lead now sits up top; only the agent note remains. */
function DevFooter() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl px-4 pb-8">
      <AgentFriendlyNote example={t("agentNote.exampleDev")} />
    </div>
  );
}
