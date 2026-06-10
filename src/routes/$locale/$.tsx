import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import type { LocaleManifest, ManifestPage } from "@shared/content-schema";
import { loadManifest, loadPage } from "@/lib/content/loader";
import { readingOrder, resolveSplat } from "@/lib/content/neighbors";
import { PageSwiper } from "@/components/reader/PageSwiper";
import { NotFound } from "@/components/shell/NotFound";
import { Button } from "@/components/ui/button";

export interface CoverData {
  kind: "cover";
  manifest: LocaleManifest;
  collection: string;
  pages: ManifestPage[];
}

export interface PageData {
  kind: "page";
  manifest: LocaleManifest;
  collection: string;
  slug: string;
}

export const Route = createFileRoute("/$locale/$")({
  loader: async ({ context, params }): Promise<CoverData | PageData> => {
    const manifest = await loadManifest(context.locale);
    const resolved = resolveSplat(manifest, params._splat ?? "");
    if (!resolved) throw notFound();

    if (!resolved.slug) {
      return {
        kind: "cover",
        manifest,
        collection: resolved.collection,
        pages: readingOrder(manifest, resolved.collection),
      };
    }

    const page = manifest.pages.find(
      (p) => p.collection === resolved.collection && p.slug === resolved.slug,
    );
    if (!page) throw notFound();
    // Warm the cache so the current pane renders without a skeleton flash;
    // the swiper itself preloads the neighbors.
    await loadPage(page.path).catch(() => {});
    return {
      kind: "page",
      manifest,
      collection: resolved.collection,
      slug: resolved.slug,
    };
  },
  component: ReaderRoute,
  notFoundComponent: NotFound,
});

function ReaderRoute() {
  const data = Route.useLoaderData();
  const { locale } = Route.useParams();

  return data.kind === "cover" ? (
    <BookCover data={data} />
  ) : (
    <PageSwiper
      locale={locale}
      manifest={data.manifest}
      collection={data.collection}
      slug={data.slug}
    />
  );
}

function BookCover({ data }: { data: CoverData }) {
  const { t } = useTranslation();
  const { locale } = Route.useParams();
  const collection = data.manifest.collections.find(
    (c) => c.slug === data.collection,
  );
  const first = data.pages[0];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <h1 className="text-3xl font-bold">
          {collection?.label ?? data.collection}
        </h1>
        {collection?.description && (
          <p className="mt-2 text-muted-foreground">{collection.description}</p>
        )}
        {first && (
          <Button asChild className="mt-6">
            <Link
              to="/$locale/$"
              params={{ locale, _splat: `${data.collection}/${first.slug}` }}
            >
              {t("reader.startReading")}
              <ChevronRight />
            </Link>
          </Button>
        )}
        <ol className="mt-8 space-y-1">
          {data.pages.map((page, i) => (
            <li key={page.slug}>
              <Link
                to="/$locale/$"
                params={{ locale, _splat: `${page.collection}/${page.slug}` }}
                className="flex items-baseline gap-3 rounded-md px-3 py-2 hover:bg-card"
              >
                <span className="w-6 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <span>{page.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
