import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookText } from "lucide-react";
import { BookCard } from "@/components/shell/BookCard";
import { ShelfHero } from "@/components/shell/ShelfHero";
import { CARD_IMAGES } from "@/lib/cardImages";
import { loadManifest } from "@/lib/content/loader";
import { siteSections } from "@/lib/siteSections";
import { UnderConstructionBanner } from "@/components/reader/UnderConstructionBanner";

export const Route = createFileRoute("/$locale/advanced/")({
  loader: async ({ context }) => {
    const manifest = await loadManifest(context.locale);
    return {
      sections: siteSections(manifest).filter((s) => s.shelf === "advanced"),
    };
  },
  component: AdvancedShelf,
});

/** Power-user shelf: the product wikis (advanced usage), own page off Home. */
function AdvancedShelf() {
  const { t } = useTranslation();
  const { locale } = Route.useParams();
  const { sections } = Route.useLoaderData();

  return (
    <div className="h-full overflow-y-auto">
      <ShelfHero src="/images/poweruser.jpg" title={t("nav.advanced")} />
      <div className="mx-auto max-w-3xl px-4 py-4 md:py-8">
        <UnderConstructionBanner />
        <p className="text-sm leading-relaxed text-foreground">
          {t("advancedFooter.lead")}
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("home.powerCardDesc")}
        </p>
        {sections.map((section) => (
          <Fragment key={section.titleKey}>
            <div className="mt-4 grid grid-cols-1 gap-2.5 md:mt-6 md:grid-cols-2 md:gap-3">
              {section.books.map((book) => (
                <BookCard
                  key={book.slug}
                  locale={locale}
                  to="/$locale/$"
                  splat={book.slug}
                  icon={BookText}
                  title={book.label}
                  description={book.description}
                  image={CARD_IMAGES[book.slug]}
                />
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
