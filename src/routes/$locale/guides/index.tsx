import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  BookText,
  Braces,
  ChevronDown,
  Code2,
  Smartphone,
  Tag,
} from "lucide-react";
import type { ManifestCollection } from "@shared/content-schema";
import { BookCard } from "@/components/shell/BookCard";
import { ShelfHero } from "@/components/shell/ShelfHero";
import { CARD_IMAGES } from "@/lib/cardImages";
import { loadManifest } from "@/lib/content/loader";
import { siteSections } from "@/lib/siteSections";

export const Route = createFileRoute("/$locale/guides/")({
  loader: async ({ context }) => {
    const manifest = await loadManifest(context.locale);
    return {
      sections: siteSections(manifest).filter((s) => s.shelf === "guides"),
    };
  },
  component: GuidesShelf,
});

const SECTION_ICONS = {
  "nav.deployApp": Smartphone,
  "sections.products": BookOpen,
  "nav.advanced": BookText,
  "sections.developer": Code2,
} as const;

function bookIcon(titleKey: string) {
  return SECTION_ICONS[titleKey as keyof typeof SECTION_ICONS] ?? BookOpen;
}

/**
 * The guides shelf: Deploy App and the product guides under toporg-style
 * headings. Advanced (wikis) and Developer content have their own shelves,
 * reached from Home and the context-aware bottom bar.
 */
function GuidesShelf() {
  const { t } = useTranslation();
  const { locale } = Route.useParams();
  const { sections } = Route.useLoaderData();

  return (
    <div className="h-full overflow-y-auto">
      <ShelfHero
        src="/images/guides.jpeg"
        title={t("nav.guides")}
        position="object-[center_80%]"
      />
      <div className="mx-auto max-w-3xl px-4 py-4 md:py-8">
        {sections.map((section) => (
          <Fragment key={section.titleKey}>
            <h2 className="px-1 pt-5 pb-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
              {t(section.titleKey)}
            </h2>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
              {section.books.map((book: ManifestCollection) => (
                <BookCard
                  key={book.slug}
                  locale={locale}
                  to="/$locale/$"
                  splat={book.slug}
                  icon={bookIcon(section.titleKey)}
                  title={book.label}
                  description={book.description}
                  image={CARD_IMAGES[book.slug]}
                />
              ))}
              {section.withApiReference && (
                <BookCard
                  locale={locale}
                  to="/$locale/dev/api"
                  icon={Braces}
                  title={t("apiRef.title")}
                  description={t("apiRef.descGuides")}
                />
              )}
              {section.withReleases && (
                <BookCard
                  locale={locale}
                  to="/$locale/dev/releases"
                  icon={Tag}
                  title={t("releases.title")}
                  description={t("releases.desc")}
                />
              )}
            </div>
          </Fragment>
        ))}
      </div>
      <GuidesFooter />
    </div>
  );
}

/** Product integrations covered by the guides; body text lives in i18n. */
const PRODUCTS = [
  { name: "TAK", bodyKey: "guidesFooter.products.tak" },
  { name: "Matrix", bodyKey: "guidesFooter.products.matrix" },
  { name: "MediaMTX", bodyKey: "guidesFooter.products.mediamtx" },
  { name: "CryptPad", bodyKey: "guidesFooter.products.cryptpad" },
] as const;

/** Guides-page footer, styled like the Deploy App (home) footer. */
function GuidesFooter() {
  const { t } = useTranslation();
  return (
    <footer className="mt-4 border-t border-border bg-card md:mt-8">
      <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
        <p className="text-sm leading-relaxed text-foreground">
          {t("guidesFooter.lead")}
        </p>

        {/* Collapsed by default; native disclosure keeps it JS-free. */}
        <details className="group mt-5 rounded-lg border border-border bg-background">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-base font-semibold select-none [&::-webkit-details-marker]:hidden">
            {t("footer.tellMore")}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4">
            {PRODUCTS.map((p) => (
              <div key={p.name}>
                <p className="mt-4 text-[11px] font-semibold tracking-widest text-primary uppercase">
                  {p.name}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t(p.bodyKey)}
                </p>
              </div>
            ))}

            <p className="mt-5 text-[11px] font-semibold tracking-widest text-primary uppercase">
              {t("guidesFooter.devTitle")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("guidesFooter.devBody")}
            </p>

            <p className="mt-4 text-[11px] font-semibold tracking-widest text-primary uppercase">
              {t("guidesFooter.wantTitle")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("guidesFooter.wantBody")}
            </p>
          </div>
        </details>
      </div>
    </footer>
  );
}
