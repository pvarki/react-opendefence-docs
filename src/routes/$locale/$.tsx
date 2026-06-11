import { useEffect, useState } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check, ChevronRight, Download, Languages } from "lucide-react";
import {
  DEFAULT_LOCALE,
  type Locale,
  type LocaleManifest,
  type ManifestPage,
} from "@shared/content-schema";
import { loadManifest, loadPage } from "@/lib/content/loader";
import { readingOrder, resolveSplat } from "@/lib/content/neighbors";
import { downloadCollectionImages } from "@/lib/pwa/offline-download";
import { setPlatform, usePlatform } from "@/lib/platform";
import { PageSwiper } from "@/components/reader/PageSwiper";
import { NotFound } from "@/components/shell/NotFound";
import { SidebarNav } from "@/components/shell/SidebarNav";
import { ReaderBar } from "@/components/shell/ReaderBar";
import { Button } from "@/components/ui/button";

export interface ReaderData {
  kind: "cover" | "page";
  manifest: LocaleManifest;
  /** Locale the content actually comes from (en when falling back). */
  contentLocale: Locale;
  /** True when the URL locale has no translation and en content is shown. */
  fallback: boolean;
  collection: string;
  slug?: string;
  pages: ManifestPage[];
}

async function resolveForLocale(
  locale: Locale,
  splat: string,
): Promise<Omit<ReaderData, "contentLocale" | "fallback"> | undefined> {
  let manifest: LocaleManifest;
  try {
    manifest = await loadManifest(locale);
  } catch {
    return undefined;
  }
  const resolved = resolveSplat(manifest, splat);
  if (!resolved) return undefined;

  const pages = readingOrder(manifest, resolved.collection);
  if (!resolved.slug) {
    // A cover with zero readable pages means the book isn't translated yet.
    if (pages.length === 0) return undefined;
    return { kind: "cover", manifest, collection: resolved.collection, pages };
  }

  const page = manifest.pages.find(
    (p) => p.collection === resolved.collection && p.slug === resolved.slug,
  );
  if (!page) return undefined;
  // Warm the cache so the current pane renders without a skeleton flash;
  // the swiper itself preloads the neighbors.
  await loadPage(page.path).catch(() => {});
  return {
    kind: "page",
    manifest,
    collection: resolved.collection,
    slug: resolved.slug,
    pages,
  };
}

export const Route = createFileRoute("/$locale/$")({
  validateSearch: (search: Record<string, unknown>): { slide?: number } => {
    const slide = Number(search.slide);
    return Number.isInteger(slide) && slide >= 1 ? { slide } : {};
  },
  loader: async ({ context, params }): Promise<ReaderData> => {
    const splat = params._splat ?? "";
    const own = await resolveForLocale(context.locale, splat);
    if (own) return { ...own, contentLocale: context.locale, fallback: false };

    // Untranslated page or book: serve English with a banner rather than 404 —
    // fi/sv coverage trails en and gaps must not look like missing docs.
    if (context.locale !== DEFAULT_LOCALE) {
      const en = await resolveForLocale(DEFAULT_LOCALE, splat);
      if (en) return { ...en, contentLocale: DEFAULT_LOCALE, fallback: true };
    }
    throw notFound();
  },
  component: ReaderRoute,
  notFoundComponent: NotFound,
});

function ReaderRoute() {
  const data = Route.useLoaderData();
  const { locale } = Route.useParams();
  const platform = usePlatform();
  const bookLabel =
    data.manifest.collections.find((c) => c.slug === data.collection)?.label ??
    data.collection;
  const currentPage =
    data.kind === "page"
      ? data.pages.find((p) => p.slug === data.slug)
      : undefined;

  // Deep links (search, shared URLs) into another platform's pages switch
  // the selector — the page the user asked for always wins.
  useEffect(() => {
    if (currentPage?.platform && currentPage.platform !== platform) {
      setPlatform(currentPage.platform);
    }
  }, [currentPage, platform]);

  return (
    <div className="flex h-full">
      <SidebarNav
        locale={locale}
        contentLocale={data.contentLocale}
        collection={data.collection}
        currentSlug={data.slug}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <ReaderBar
          locale={locale}
          collection={data.collection}
          bookLabel={bookLabel}
          breadcrumb={currentPage?.breadcrumb}
        />
        {data.fallback && <FallbackBanner />}
        <div className="min-h-0 flex-1">
          {data.kind === "cover" || !data.slug ? (
            <BookCover data={data} bookLabel={bookLabel} />
          ) : (
            <PageSwiper
              locale={locale}
              manifest={data.manifest}
              collection={data.collection}
              slug={data.slug}
              platform={currentPage?.platform ?? platform}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FallbackBanner() {
  const { t } = useTranslation();
  return (
    <p className="flex shrink-0 items-center gap-2 border-b border-border bg-warning/10 px-4 py-2 text-xs text-warning md:px-6">
      <Languages className="size-3.5 shrink-0" />
      {t("reader.notTranslated")}
    </p>
  );
}

function BookCover({
  data,
  bookLabel,
}: {
  data: ReaderData;
  bookLabel: string;
}) {
  const { t } = useTranslation();
  const { locale } = Route.useParams();
  const platform = usePlatform();
  const collection = data.manifest.collections.find(
    (c) => c.slug === data.collection,
  );
  const pages = readingOrder(data.manifest, data.collection, platform);
  const first = pages[0];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <h1 className="text-3xl font-bold">{bookLabel}</h1>
        {collection?.description && (
          <p className="mt-2 text-muted-foreground">{collection.description}</p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {first && (
            <Button asChild>
              <Link
                to="/$locale/$"
                params={{ locale, _splat: `${data.collection}/${first.slug}` }}
              >
                {t("reader.startReading")}
                <ChevronRight />
              </Link>
            </Button>
          )}
          <OfflineDownloadButton
            manifest={data.manifest}
            collection={data.collection}
          />
        </div>
        <ol className="mt-8 space-y-1">
          {pages.map((page, i) => (
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

function OfflineDownloadButton({
  manifest,
  collection,
}: {
  manifest: LocaleManifest;
  collection: string;
}) {
  const [state, setState] = useState<
    | { phase: "idle" }
    | { phase: "downloading"; done: number; total: number }
    | { phase: "done" }
  >({ phase: "idle" });

  const start = () => {
    setState({ phase: "downloading", done: 0, total: 0 });
    void downloadCollectionImages(manifest, collection, (done, total) =>
      setState({ phase: "downloading", done, total }),
    ).then(() => setState({ phase: "done" }));
  };

  return (
    <Button
      variant="outline"
      onClick={start}
      disabled={state.phase !== "idle"}
      aria-live="polite"
    >
      {state.phase === "done" ? <Check /> : <Download />}
      {state.phase === "downloading"
        ? `${state.done}/${state.total || "…"}`
        : state.phase === "done"
          ? "Offline"
          : "Offline"}
    </Button>
  );
}
