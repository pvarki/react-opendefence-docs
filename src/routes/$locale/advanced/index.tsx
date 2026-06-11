import { Link, createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookText } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <h1 className="text-2xl font-bold md:text-3xl">{t("nav.advanced")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground md:text-base">
          {t("home.powerCardDesc")}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {books.map((book) => (
            <Link
              key={book.slug}
              to="/$locale/$"
              params={{ locale, _splat: book.slug }}
              className="group focus-visible:outline-none"
            >
              <Card className="h-full gap-3 py-5 transition-colors group-hover:border-primary group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CardHeader>
                  <BookText className="mb-2 size-6 text-primary" />
                  <CardTitle>{book.label}</CardTitle>
                  {book.description && (
                    <CardDescription>{book.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
