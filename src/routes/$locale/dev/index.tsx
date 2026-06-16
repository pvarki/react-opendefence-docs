import { Fragment, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Braces, ChevronRight, Code2 } from "lucide-react";
import type { ManifestCollection } from "@shared/content-schema";
import { BookCard } from "@/components/shell/BookCard";
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

    return { books, firstPages, relComponents };
  },
  component: DevShelf,
});

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-1 pt-6 pb-2 text-[11px] font-semibold tracking-widest text-foreground uppercase">
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
  const { books, firstPages, relComponents } = Route.useLoaderData();

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
      </div>
      <DevFooter />
    </div>
  );
}

/** Develop-page footer, styled like the Deploy App (home) footer. */
function DevFooter() {
  const { t } = useTranslation();
  return (
    <footer className="mt-4 border-t border-border bg-card md:mt-8">
      <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
        <p className="text-sm leading-relaxed text-foreground">
          {t("devFooter.leadBefore")}
          <strong className="font-semibold text-primary">
            {t("devFooter.leadEmphasis")}
          </strong>
          {t("devFooter.leadAfter")}
        </p>
      </div>
    </footer>
  );
}
