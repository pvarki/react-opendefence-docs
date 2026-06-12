import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookOpen, BookText, Braces, Code2, Smartphone } from "lucide-react";
import type { ManifestCollection } from "@shared/content-schema";
import { BookCard } from "@/components/shell/BookCard";
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
      <div className="mx-auto max-w-3xl px-4 py-5 md:py-12">
        <h1 className="text-xl font-bold md:text-3xl">{t("nav.guides")}</h1>
        {sections.map((section) => (
          <Fragment key={section.titleKey}>
            <h2 className="px-1 pt-5 pb-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
              {t(section.titleKey)}
            </h2>
            <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
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
                  title="API Reference"
                  description="rasenmaeher-api & integration APIs (OpenAPI)"
                />
              )}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
