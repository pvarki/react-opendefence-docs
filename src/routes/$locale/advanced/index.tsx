import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookText } from "lucide-react";
import { BookCard } from "@/components/shell/BookCard";
import { CARD_IMAGES } from "@/lib/cardImages";
import { loadManifest } from "@/lib/content/loader";

export const Route = createFileRoute("/$locale/advanced/")({
  loader: async ({ context }) => {
    const manifest = await loadManifest(context.locale);
    return {
      // Wiki collections are power-user content: advanced product usage.
      books: manifest.collections.filter((c) => c.section === "wikis"),
    };
  },
  component: AdvancedShelf,
});

function AdvancedShelf() {
  const { t } = useTranslation();
  const { locale } = Route.useParams();
  const { books } = Route.useLoaderData();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-5 md:py-12">
        <h1 className="text-xl font-bold md:text-3xl">{t("nav.advanced")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("home.powerCardDesc")}
        </p>
        <div className="mt-4 grid gap-2.5 md:mt-6 md:grid-cols-2 md:gap-3">
          {books.map((book) => (
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
      </div>
    </div>
  );
}
