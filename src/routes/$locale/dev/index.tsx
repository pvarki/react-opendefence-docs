import { Link, createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookText, Braces, Code2 } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadManifest } from "@/lib/content/loader";
import { readingOrder } from "@/lib/content/neighbors";

export const Route = createFileRoute("/$locale/dev/")({
  loader: async ({ context }) => {
    const manifest = await loadManifest(context.locale);
    const devBook = manifest.collections.find((c) => c.slug === "dev");
    return {
      devBook,
      devFirstPage: devBook ? readingOrder(manifest, "dev")[0] : undefined,
      wikis: manifest.collections.filter((c) => c.section === "wikis"),
    };
  },
  component: DevShelf,
});

function DevShelf() {
  const { t } = useTranslation();
  const { locale } = Route.useParams();
  const { devBook, devFirstPage, wikis } = Route.useLoaderData();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <h1 className="text-2xl font-bold md:text-3xl">{t("nav.develop")}</h1>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {devBook && devFirstPage && (
            <Link
              to="/$locale/$"
              params={{ locale, _splat: `dev/${devFirstPage.slug}` }}
              className="group focus-visible:outline-none"
            >
              <Card className="h-full gap-3 py-5 transition-colors group-hover:border-primary group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CardHeader>
                  <Code2 className="mb-2 size-6 text-primary" />
                  <CardTitle>{devBook.label}</CardTitle>
                  {devBook.description && (
                    <CardDescription>{devBook.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          )}
          {wikis.map((wiki) => (
            <Link
              key={wiki.slug}
              to="/$locale/$"
              params={{ locale, _splat: wiki.slug }}
              className="group focus-visible:outline-none"
            >
              <Card className="h-full gap-3 py-5 transition-colors group-hover:border-primary group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CardHeader>
                  <BookText className="mb-2 size-6 text-primary" />
                  <CardTitle>{wiki.label}</CardTitle>
                  {wiki.description && (
                    <CardDescription>{wiki.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
          <Link
            to="/$locale/dev/api"
            params={{ locale }}
            className="group focus-visible:outline-none"
          >
            <Card className="h-full gap-3 py-5 transition-colors group-hover:border-primary group-focus-visible:ring-2 group-focus-visible:ring-ring">
              <CardHeader>
                <Braces className="mb-2 size-6 text-primary" />
                <CardTitle>API Reference</CardTitle>
                <CardDescription>
                  rasenmaeher-api &amp; integration APIs (OpenAPI)
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
