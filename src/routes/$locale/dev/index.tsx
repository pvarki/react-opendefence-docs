import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Braces, Code2 } from "lucide-react";
import { BookCard } from "@/components/shell/BookCard";
import { loadManifest } from "@/lib/content/loader";
import { readingOrder } from "@/lib/content/neighbors";

export const Route = createFileRoute("/$locale/dev/")({
  loader: async ({ context }) => {
    const manifest = await loadManifest(context.locale);
    const devBook = manifest.collections.find((c) => c.slug === "dev");
    return {
      devBook,
      devFirstPage: devBook ? readingOrder(manifest, "dev")[0] : undefined,
    };
  },
  component: DevShelf,
});

function DevShelf() {
  const { t } = useTranslation();
  const { locale } = Route.useParams();
  const { devBook, devFirstPage } = Route.useLoaderData();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-5 md:py-12">
        <h1 className="text-xl font-bold md:text-3xl">{t("nav.develop")}</h1>
        <div className="mt-4 grid grid-cols-1 gap-2.5 md:mt-6 md:grid-cols-2 md:gap-3">
          {devBook && devFirstPage && (
            <BookCard
              locale={locale}
              to="/$locale/$"
              splat={`dev/${devFirstPage.slug}`}
              icon={Code2}
              title={devBook.label}
              description={devBook.description}
            />
          )}
          <BookCard
            locale={locale}
            to="/$locale/dev/api"
            icon={Braces}
            title="API Reference"
            description="rasenmaeher-api & integration APIs (OpenAPI)"
          />
        </div>
      </div>
    </div>
  );
}
