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
  type Locale,
  type LocaleManifest,
  type ManifestPage,
  type SidebarConfig,
} from "@shared/content-schema";
import { CARD_IMAGES, COVER_HEROES } from "@/lib/cardImages";
import { withBase } from "@/lib/base";
import i18n from "@/lib/i18n";
import { loadManifest, loadPage, loadSidebar } from "@/lib/content/loader";
import {
  filterSidebarByClient,
  readingOrder,
  resolveClient,
  resolveSplat,
} from "@/lib/content/neighbors";
import { downloadCollectionImages } from "@/lib/pwa/offline-download";
import { setClientForBook, setPlatform, useReadingView } from "@/lib/platform";
import { usePlatformPicker } from "@/lib/usePlatformPicker";
import { PageSwiper } from "@/components/reader/PageSwiper";
import { NotFound } from "@/components/shell/NotFound";
import { PlatformList } from "@/components/shell/PlatformList";
import { ShelfHero } from "@/components/shell/ShelfHero";
import {
  DevDocsSidebar,
  SidebarItems,
  SidebarNav,
} from "@/components/shell/SidebarNav";
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
    } else if (
      !currentPage!.clientId &&
      currentPage!.platform &&
      currentPage!.platform !== view.platform
    ) {
      setPlatform(currentPage!.platform);
    }
  }, [currentPage, activeClient, view.platform]);

  return (
    <div className="flex h-full">
      {isDevSection ? (
        <DevDocsSidebar
          locale={locale}
          contentLocale={data.contentLocale}
          manifest={data.manifest}
          currentCollection={data.collection}
          currentSlug={data.slug}
          clientId={activeClient?.id}
        />
      ) : (
        <SidebarNav
          locale={locale}
          contentLocale={data.contentLocale}
          collection={data.collection}
          currentSlug={data.slug}
          clientId={activeClient?.id}
        />
      )}
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
              view={view}
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
  const view = useReadingView();
  const collection = data.manifest.collections.find(
    (c) => c.slug === data.collection,
  );
  const hero = COVER_HEROES[data.collection];
  const { options, active, pick, hasClients } = usePlatformPicker(data);
  const pages = readingOrder(data.manifest, data.collection, view);
  const first = pages[0];

  // The cover IS the book's table of contents: the same grouped chapter tree
  // as the Contents sheet, chapters collapsed for a scannable overview.
  const [sidebar, setSidebar] = useState<SidebarConfig>();
  useEffect(() => {
    let cancelled = false;
    loadSidebar(data.contentLocale, data.collection)
      .then((config) => {
        if (!cancelled) setSidebar(config);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [data.contentLocale, data.collection]);

  return (
    <div className="h-full overflow-y-auto">
      {hero && (
        <ShelfHero src={hero.src} title={bookLabel} position={hero.position} />
      )}
      <div
        className={`mx-auto max-w-3xl px-4 ${
          hero ? "py-4 md:py-8" : "py-5 md:py-12"
        }`}
      >
        {!hero && (
          <h1 className="text-xl font-bold md:text-3xl">{bookLabel}</h1>
        )}
        {collection?.description && (
          <p className="mt-1.5 text-sm text-muted-foreground md:text-base">
            {collection.description}
          </p>
        )}
        {hasClients && (
          <div className="mt-4 md:mt-6">
            <p className="pb-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
              {t("platform.available")}
            </p>
            <PlatformList
              options={options}
              activeId={active?.id}
              onPick={pick}
            />
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3 md:mt-6">
          {first && (
            <Button asChild className="hidden md:inline-flex">
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
        <nav aria-label={t("nav.contents")} className="mt-5 md:mt-8">
          {sidebar && (
            <SidebarItems
              items={filterSidebarByClient(
                sidebar.items,
                hasClients ? active?.id : undefined,
              )}
              locale={locale}
              collection={data.collection}
            />
          )}
        </nav>
        {/* Thumb-reach Start reading: floats bottom-left above the tab bar,
            next to the floating back button. */}
        {first && (
          <Button
            asChild
            className="fixed bottom-[calc(var(--tabbar-h)+0.75rem)] left-16 z-40 shadow-lg md:hidden"
          >
            <Link
              to="/$locale/$"
              params={{ locale, _splat: `${data.collection}/${first.slug}` }}
            >
              {t("reader.startReading")}
              <ChevronRight />
            </Link>
          </Button>
        )}
      </div>
      <GuideFooter collection={data.collection} />
      {/* Scroll-end clearance: the floating Start reading / back buttons
          hover here instead of covering the last content. */}
      <div aria-hidden className="h-16 md:hidden" />
    </div>
  );
}

function GuideFooter({ collection }: { collection: string }) {
  const { t } = useTranslation();
  const slug = collection.replace(/^guides\//, "");
  const kp = `guideFooter.${slug}`;

  if (!i18n.exists(`${kp}.lead`)) return null;

  const cardImage = CARD_IMAGES[collection];
  const hasPhoto = !!cardImage && !cardImage.logo;

  const goals = [
    { title: `${kp}.goal1Title`, body: `${kp}.goal1Body` },
    { title: `${kp}.goal2Title`, body: `${kp}.goal2Body` },
    { title: `${kp}.goal3Title`, body: `${kp}.goal3Body` },
  ];

  return (
    <footer className="mt-4 border-t border-border bg-card md:mt-8">
      <div className="relative overflow-hidden">
        {hasPhoto && (
          <>
            <img
              src={withBase(cardImage.src)}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
            />
            <div className="absolute inset-0 bg-black/60" />
          </>
        )}
        <div
          className={
            hasPhoto
              ? "relative mx-auto max-w-2xl px-4 py-8 md:py-12"
              : "mx-auto max-w-2xl px-4 py-6 md:py-8"
          }
        >
          <p
            className={
              hasPhoto
                ? "text-sm leading-relaxed text-white"
                : "text-sm leading-relaxed text-foreground"
            }
          >
            {t(`${kp}.lead`)}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-6 md:pb-10">
        <details className="group mt-5 rounded-lg border border-border bg-background">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-base font-semibold select-none [&::-webkit-details-marker]:hidden">
            {t("footer.tellMore")}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(`${kp}.core`)}
            </p>
            {goals.map(({ title, body }) => (
              <div key={title}>
                <p className="mt-4 text-[11px] font-semibold tracking-widest text-primary uppercase">
                  {t(title)}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t(body)}
                </p>
              </div>
            ))}
          </div>
        </details>

        <div className="mt-6 space-y-0.5 border-t border-border pt-4">
          <p className="text-[11px] text-muted-foreground/80">
            {t(`${kp}.copyright`)}
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            {t("guideFooter.maintainedBy")}
          </p>
        </div>
      </div>
    </footer>
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
        : "Offline"}
    </Button>
  );
}
