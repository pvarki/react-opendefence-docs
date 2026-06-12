import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";
import { BookCard } from "@/components/shell/BookCard";
import { CARD_IMAGES } from "@/lib/cardImages";
import { loadManifest } from "@/lib/content/loader";

export const Route = createFileRoute("/$locale/guides/")({
  loader: async ({ context }) => {
    const manifest = await loadManifest(context.locale);
    return {
      books: manifest.collections.filter((c) => c.section === "guides"),
    };
  },
  component: GuidesShelf,
});

function GuidesShelf() {
  const { t } = useTranslation();
  const { locale } = Route.useParams();
  const { books } = Route.useLoaderData();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-5 md:py-12">
        <h1 className="text-xl font-bold md:text-3xl">{t("nav.guides")}</h1>
        <div className="mt-4 grid gap-2.5 md:mt-6 md:grid-cols-2 md:gap-3">
          {books.map((book) => (
            <BookCard
              key={book.slug}
              locale={locale}
              to="/$locale/$"
              splat={book.slug}
              icon={BookOpen}
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
