import { Link, createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <h1 className="text-2xl font-bold md:text-3xl">{t("nav.guides")}</h1>
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
                  <BookOpen className="mb-2 size-6 text-primary" />
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
