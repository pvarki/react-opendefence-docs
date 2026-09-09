import { Suspense, lazy, useEffect, useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Braces } from "lucide-react";
import { DEFAULT_LOCALE } from "@shared/content-schema";
import { loadManifest } from "@/lib/content/loader";
import { SidebarNav } from "@/components/shell/SidebarNav";
import { ReaderBar } from "@/components/shell/ReaderBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { HtmlBlock } from "@/components/blocks/HtmlBlock";
import { withBase } from "@/lib/base";
import { cn } from "@/lib/utils";
import {
  loadRefDoc,
  refDocPath,
  REF_LABEL_KEY,
  releasesForBook,
  resolveVersion,
  specForBook,
  type DevRefKind,
  type ReleaseComponent,
  type SpecSource,
} from "@/lib/devNav";

const VIEWS = ["api", "releases", "notes", "changelog"] as const;

// Bundled, not CDN, so the reference works air-gapped; its stylesheet rides
// this lazy chunk, without which Scalar renders unstyled.
const ApiReference = lazy(() =>
  Promise.all([
    import("@scalar/api-reference-react"),
    import("@scalar/api-reference-react/style.css"),
    import("@/scalar-theme.css"),
  ]).then(([m]) => ({ default: m.ApiReferenceReact })),
);

export const Route = createFileRoute("/$locale/dev/$book/$view")({
  validateSearch: (search: Record<string, unknown>): { v?: string } =>
    typeof search.v === "string" ? { v: search.v } : {},
  loader: async ({ context, params }) => {
    const view = VIEWS.find((v) => v === params.view);
    if (!view) throw notFound();

    // fi/sv manifests carry no dev books; fall back to en like the reader.
    const own = await loadManifest(context.locale);
    const inOwn = own.collections.some((c) => c.slug === params.book);
    const manifest = inOwn ? own : await loadManifest(DEFAULT_LOCALE);
    if (!manifest.collections.some((c) => c.slug === params.book)) {
      throw notFound();
    }

    return {
      view,
      contentLocale: inOwn ? context.locale : DEFAULT_LOCALE,
      manifest,
      source: await specForBook(params.book),
      component: await releasesForBook(params.book),
    };
  },
  component: DevRefPage,
});

/** Shown only when there is a choice; ?v= keeps it linkable. */
function VersionSelect({
  value,
  options,
  className,
  onChange,
}: {
  value: string;
  options: { tag: string; label?: string }[];
  className?: string;
  onChange: (tag: string) => void;
}) {
  if (options.length < 2) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.tag} value={option.tag}>
              {option.label ?? option.tag}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function useVersionParam() {
  const { v } = Route.useSearch();
  const navigate = Route.useNavigate();
  return [
    v,
    (tag: string) => void navigate({ search: { v: tag }, replace: true }),
  ] as const;
}

function DevRefPage() {
  const { t } = useTranslation();
  const data = Route.useLoaderData();
  const { locale, book, view } = Route.useParams();
  const label =
    data.manifest.collections.find((c) => c.slug === book)?.label ?? book;

  return (
    <div className="flex h-full">
      <SidebarNav
        locale={locale}
        contentLocale={data.contentLocale}
        manifest={data.manifest}
        collection={book}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <ReaderBar
          locale={locale}
          collection={book}
          bookLabel={label}
          breadcrumb={[t(REF_LABEL_KEY[view as DevRefKind])]}
        />
        <div className="min-h-0 flex-1">
          {data.view === "api" ? (
            <ApiView source={data.source} />
          ) : (
            <ReleaseView view={data.view} component={data.component} />
          )}
        </div>
      </div>
    </div>
  );
}

function ApiView({ source }: { source?: SpecSource }) {
  const { t } = useTranslation();
  const [tag, setTag] = useVersionParam();
  const active = source && resolveVersion(source.versions, tag);

  if (!source || !active) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-2xl font-bold">{t("apiRef.title")}</h1>
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-6 text-muted-foreground">
            <Braces className="size-5 text-primary" />
            {t("apiRef.empty")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <VersionSelect
        value={active.tag}
        options={source.versions}
        onChange={setTag}
        className="shrink-0 border-b border-border px-4 py-2"
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Suspense
          fallback={
            <div className="space-y-3 p-8" aria-busy="true">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-96 w-full" />
            </div>
          }
        >
          <ApiReference
            configuration={{
              // Root-absolute: a bare filename would hit the SPA fallback.
              url: withBase(`/api-specs/${source.id}/${active.specFile}`),
              hideDarkModeToggle: true,
              forceDarkModeState: "dark",
              hideClientButton: true,
              agent: { disabled: true },
              // Can't work: templated server host, and the API wants mTLS.
              hideTestRequestButton: true,
              // Scalar shows a Configure/Share toolbar on localhost; never here.
              showDeveloperTools: "never",
              searchHotKey: "i",
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}

/** Pre-rendered release-doc HTML; null once the fetch has failed. */
function useDocHtml(file: string | undefined): {
  html: string | null | undefined;
  loading: boolean;
} {
  // Keyed by file so a stale fetch never shows under a newly selected doc.
  const [state, setState] = useState<{
    file?: string;
    html?: string | null;
  }>({});
  useEffect(() => {
    if (!file) return;
    let active = true;
    void loadRefDoc(file).then((doc) => {
      if (active) setState({ file, html: doc ? doc.html : null });
    });
    return () => {
      active = false;
    };
  }, [file]);
  const html = state.file === file ? state.html : undefined;
  return { html, loading: !!file && html === undefined };
}

function ReleaseView({
  view,
  component,
}: {
  view: Exclude<DevRefKind, "api">;
  component?: ReleaseComponent;
}) {
  const { t } = useTranslation();
  const [tag, setTag] = useVersionParam();
  const selected = component && resolveVersion(component.releases, tag);
  const file = component ? refDocPath(component, view, selected) : undefined;
  const { html, loading } = useDocHtml(file);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">{t(REF_LABEL_KEY[view])}</h1>
          {view === "releases" && component && selected && (
            <VersionSelect
              value={selected.tag}
              options={component.releases.map((r) => ({
                tag: r.tag,
                label: r.prerelease ? `${r.tag} (pre)` : r.tag,
              }))}
              onChange={setTag}
            />
          )}
        </div>
        <div className="mt-4">
          {loading ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : html === null ? (
            <p className="text-sm text-warning">{t("releases.loadFailed")}</p>
          ) : html ? (
            <HtmlBlock html={html} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("releases.nothingYet")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
