import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Languages,
} from "lucide-react";
import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  type LocaleManifest,
  type ManifestPage,
} from "@shared/content-schema";
import type { BookContext } from "@/lib/bookContext";
import i18n from "@/lib/i18n";
import { loadManifest, loadPage } from "@/lib/content/loader";
import {
  readerBreadcrumb,
  readingOrder,
  resolveClient,
  resolveSplat,
} from "@/lib/content/neighbors";
import { downloadCollectionImages } from "@/lib/pwa/offline-download";
import { isCoverUnderConstruction } from "@/lib/underConstruction";
import { UnderConstructionBanner } from "@/components/reader/UnderConstructionBanner";
import { setClientForBook, setPlatform, useReadingView } from "@/lib/platform";
import { usePlatformPicker } from "@/lib/usePlatformPicker";
import { PageSwiper } from "@/components/reader/PageSwiper";
import { NotFound } from "@/components/shell/NotFound";
import { PlatformList } from "@/components/shell/PlatformList";
import { ShelfHero } from "@/components/shell/ShelfHero";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { DevRefList, SidebarNav } from "@/components/shell/SidebarNav";
import { loadDevRefs, type DevRef } from "@/lib/devNav";
import { ReaderBar } from "@/components/shell/ReaderBar";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { PAGE_FRAME } from "@/lib/pageFrame";
import { cn } from "@/lib/utils";

export interface ReaderData extends BookContext {
  kind: "cover" | "page";
  /** True when the URL locale has no translation and another locale's content is shown. */
  fallback: boolean;
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

    // Untranslated page or book: serve another locale's content with a banner
    // rather than 404, English first. Page slugs are unique across locales,
    // so a page only resolves in its own locale.
    const others = [DEFAULT_LOCALE, ...LOCALES].filter(
      (l, i, all) => l !== context.locale && all.indexOf(l) === i,
    );
    for (const other of others) {
      const found = await resolveForLocale(other, splat);
      if (found) return { ...found, contentLocale: other, fallback: true };
    }
    throw notFound();
  },
  component: ReaderRoute,
  notFoundComponent: NotFound,
});

function ReaderRoute() {
  const data = Route.useLoaderData();
  const { locale } = Route.useParams();
  const view = useReadingView();
  const collectionMeta = data.manifest.collections.find(
    (c) => c.slug === data.collection,
  );
  const bookLabel = collectionMeta?.label ?? data.collection;
  const isDevSection = collectionMeta?.section === "dev";
  const currentPage =
    data.kind === "page"
      ? data.pages.find((p) => p.slug === data.slug)
      : undefined;
  const activeClient = resolveClient(data.manifest, data.collection, view);

  // Deep links (search, shared URLs) into another client's pages switch the
  // selector — the page the user asked for wins, but only when the PAGE
  // changes: an explicit pick (which navigates separately) must not be
  // fought back.
  const lastPageKeyRef = useRef<string>(undefined);
  useEffect(() => {
    const key = currentPage
      ? `${currentPage.collection}/${currentPage.slug}`
      : undefined;
    if (!key || key === lastPageKeyRef.current) return;
    lastPageKeyRef.current = key;
    if (currentPage!.clientId && currentPage!.clientId !== activeClient?.id) {
      setClientForBook(currentPage!.collection, currentPage!.clientId);
      if (currentPage!.platform) setPlatform(currentPage!.platform);
    } else if (!currentPage!.clientId) {
      // Client-less page tagged for one or more platforms: only switch the
      // global platform when the reader's current one isn't among them (so a
      // desktop guide tagged win/mac/linux leaves a Mac reader on macOS).
      const pagePlatforms = currentPage!.platforms?.length
        ? currentPage!.platforms
        : currentPage!.platform
          ? [currentPage!.platform]
          : [];
      if (pagePlatforms.length && !pagePlatforms.includes(view.platform)) {
        setPlatform(pagePlatforms[0]);
      }
    }
  }, [currentPage, activeClient, view.platform]);

  return (
    <div className="flex h-full">
      <SidebarNav
        locale={locale}
        contentLocale={data.contentLocale}
        manifest={data.manifest}
        collection={data.collection}
        currentSlug={data.slug}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <ReaderBar
          locale={locale}
          collection={data.collection}
          bookLabel={bookLabel}
          breadcrumb={
            currentPage
              ? readerBreadcrumb(data.manifest, currentPage)
              : undefined
          }
        />
        {/* Dev docs are canonically English and won't be translated, so the
            en-fallback is the intended state, not a missing translation. */}
        {data.fallback && !isDevSection && (
          <FallbackBanner contentLocale={data.contentLocale} />
        )}
        <div className="min-h-0 flex-1">
          {data.kind === "cover" || !data.slug ? (
            <BookCover data={data} bookLabel={bookLabel} />
          ) : (
            <PageSwiper
              locale={locale}
              manifest={data.manifest}
              collection={data.collection}
              slug={data.slug}
              view={view}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FallbackBanner({ contentLocale }: { contentLocale: Locale }) {
  const { t } = useTranslation();
  return (
    <p className="flex shrink-0 items-center gap-2 border-b border-border bg-warning/10 px-4 py-2 text-xs text-warning md:px-6">
      <Languages className="size-3.5 shrink-0" />
      {t(`reader.notTranslated.${contentLocale}`)}
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
  const view = useReadingView();
  const collection = data.manifest.collections.find(
    (c) => c.slug === data.collection,
  );
  const { options, active, pick, hasClients } = usePlatformPicker(data);
  const pages = readingOrder(data.manifest, data.collection, view);
  const first = pages[0];
  const intro = guideIntroKey(data.collection);

  // Reference rows the sidebar puts under this book.
  const [refs, setRefs] = useState<DevRef[]>([]);
  useEffect(() => {
    let cancelled = false;
    void loadDevRefs().then((byBook) => {
      if (!cancelled) setRefs(byBook.get(data.collection) ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [data.collection]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <ShelfHero title={bookLabel} subtitle={collection?.description} />
      <div className={cn(PAGE_FRAME, "flex-1 pt-4 pb-10 md:pt-6")}>
        <div className="max-w-3xl">
          {isCoverUnderConstruction(data.collection, active?.platform) && (
            <UnderConstructionBanner compact />
          )}
          {intro && (
            <p className="text-sm leading-relaxed text-foreground md:text-base">
              {t(`${intro}.lead`)}
            </p>
          )}
          {hasClients && (
            <div className="mt-5 md:mt-6">
              <SectionLabel className="pb-1.5">
                {t("platform.available")}
              </SectionLabel>
              <PlatformList
                options={options}
                activeId={active?.id}
                onPick={pick}
                oneRowWide
              />
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3 md:mt-5">
            {first && (
              <Button asChild>
                <Link
                  to="/$locale/$"
                  params={{
                    locale,
                    _splat: `${data.collection}/${first.slug}`,
                  }}
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
          {refs.length > 0 && (
            <div className="mt-2.5">
              <DevRefList locale={locale} refs={refs} variant="button" />
            </div>
          )}
          {intro && <GuideIntro intro={intro} />}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

function guideIntroKey(collection: string): string | undefined {
  const kp = `guideFooter.${collection.replace(/^guides\//, "")}`;
  return i18n.exists(`${kp}.lead`) ? kp : undefined;
}

function GuideIntro({ intro }: { intro: string }) {
  const { t } = useTranslation();
  const goals = [1, 2, 3].map((n) => ({
    title: `${intro}.goal${n}Title`,
    body: `${intro}.goal${n}Body`,
  }));

  return (
    <section className="mt-8 md:mt-10">
      <details className="group rounded-lg border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-base font-semibold select-none [&::-webkit-details-marker]:hidden">
          {t("footer.tellMore")}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(`${intro}.core`)}
          </p>
          {goals.map(({ title, body }) => (
            <div key={title}>
              <SectionLabel as="h3" className="mt-4">
                {t(title)}
              </SectionLabel>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t(body)}
              </p>
            </div>
          ))}
        </div>
      </details>

      <div className="mt-4 space-y-0.5">
        <p className="text-xs text-muted-foreground">
          {t(`${intro}.copyright`)}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("guideFooter.maintainedBy")}
        </p>
      </div>
    </section>
  );
}

function OfflineDownloadButton({
  manifest,
  collection,
}: {
  manifest: LocaleManifest;
  collection: string;
}) {
  const { t } = useTranslation();
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
        : t("reader.offline")}
    </Button>
  );
}
