import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookText } from "lucide-react";
import { BookCard } from "@/components/shell/BookCard";
import { ShelfHero } from "@/components/shell/ShelfHero";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { CARD_IMAGES } from "@/lib/cardImages";
import { bookDescription } from "@/lib/bookDescription";
import { loadManifest } from "@/lib/content/loader";
import { PAGE_FRAME } from "@/lib/pageFrame";
import { siteSections } from "@/lib/siteSections";
import { cn } from "@/lib/utils";

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
    <div className="flex h-full flex-col overflow-y-auto">
      <ShelfHero title={t("nav.advanced")} subtitle={t("home.powerCardDesc")} />
      <div className={cn(PAGE_FRAME, "pt-4 pb-8 md:pt-6 md:pb-10")}>
        <div className="max-w-3xl">
          <p className="text-sm leading-relaxed text-foreground md:text-base">
            {t("advancedFooter.lead")}
          </p>
        </div>
        {sections.map((section) => (
          <Fragment key={section.titleKey}>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:mt-6 md:gap-3 lg:grid-cols-3">
              {section.books.map((book) => (
                <BookCard
                  key={book.slug}
                  locale={locale}
                  to="/$locale/$"
                  splat={book.slug}
                  icon={BookText}
                  title={book.label}
                  description={bookDescription(t, book)}
                  image={CARD_IMAGES[book.slug]}
                />
              ))}
            </div>
          </Fragment>
        ))}
      </div>
      <SiteFooter />
    </div>
  );
}
