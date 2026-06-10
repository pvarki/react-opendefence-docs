import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  LocaleManifest,
  ManifestPage,
  PageDoc,
} from "@shared/content-schema";
import { loadManifest, loadPage } from "@/lib/content/loader";
import {
  readingOrder,
  resolvePosition,
  resolveSplat,
} from "@/lib/content/neighbors";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
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
  doc: PageDoc;
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

    const position = resolvePosition(
      manifest,
      resolved.collection,
      resolved.slug,
    );
    if (!position) throw notFound();
    const doc = await loadPage(position.page.path);
    return {
      kind: "page",
      manifest,
      collection: resolved.collection,
      slug: resolved.slug,
      doc,
    };
  },
  component: ReaderRoute,
  notFoundComponent: NotFound,
});

function ReaderRoute() {
  const data = Route.useLoaderData();
  return data.kind === "cover" ? (
    <BookCover data={data} />
  ) : (
    <PageView data={data} />
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

function PageView({ data }: { data: PageData }) {
  const { t } = useTranslation();
  const { locale } = Route.useParams();
  const position = resolvePosition(data.manifest, data.collection, data.slug);

  return (
    <div className="h-full overflow-y-auto" data-page-scroll>
      <article className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold">{data.doc.title}</h1>
        <BlockRenderer blocks={data.doc.blocks} />

        {position && (
          <nav className="mt-12 flex items-center justify-between gap-4 border-t border-border pt-6">
            {position.prev ? (
              <Link
                to="/$locale/$"
                params={{
                  locale,
                  _splat: `${position.prev.collection}/${position.prev.slug}`,
                }}
                className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-4 shrink-0" />
                <span className="truncate">{position.prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {t("reader.pageOf", {
                current: position.index + 1,
                total: position.total,
              })}
            </span>
            {position.next ? (
              <Link
                to="/$locale/$"
                params={{
                  locale,
                  _splat: `${position.next.collection}/${position.next.slug}`,
                }}
                className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <span className="truncate">{position.next.title}</span>
                <ChevronRight className="size-4 shrink-0" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </article>
    </div>
  );
}
