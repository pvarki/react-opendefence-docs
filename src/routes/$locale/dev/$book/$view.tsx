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
import {
  REF_LABEL_KEY,
  releasesForBook,
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
  loader: async ({ context, params }) => {
    const view = VIEWS.find((v) => v === params.view);
    if (!view) throw notFound();

    // fi/sv manifests carry no dev books; fall back to en like the reader.
    const own = await loadManifest(context.locale);
    const contentLocale = own.collections.some((c) => c.slug === params.book)
      ? context.locale
      : DEFAULT_LOCALE;

    // Both lookups read manifests the sidebar loads here anyway.
    return {
      view,
      contentLocale,
      manifest: await loadManifest(contentLocale),
      source: await specForBook(params.book),
      component: await releasesForBook(params.book),
    };
  },
  component: DevRefPage,
});

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
  const versions = source?.versions ?? [];
  const [tag, setTag] = useState(versions[0]?.tag);
  const active = versions.find((v) => v.tag === tag) ?? versions[0];

  if (!active) {
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
      {versions.length > 1 && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
          <Select value={active.tag} onValueChange={setTag}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.tag} value={v.tag}>
                  {v.tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
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
              url: withBase(`/api-specs/${source!.id}/${active.specFile}`),
              hideDarkModeToggle: true,
              forceDarkModeState: "dark",
              hideClientButton: true,
              agent: { disabled: true },
              // Can't work: templated server host, and the API wants mTLS.
              hideTestRequestButton: true,
              // Scalar shows a Configure/Share toolbar on localhost; never here.
              showDeveloperTools: "never",
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}

/** Lazily fetch a pre-rendered release-doc JSON ({ html }) by root-abs path. */
function useDocHtml(file: string | undefined): {
  html: string | undefined;
  loading: boolean;
} {
  // Keyed by file so a stale fetch never shows under a newly selected doc.
  const [state, setState] = useState<{ file?: string; html?: string }>({});
  useEffect(() => {
    if (!file) return;
    let active = true;
    fetch(withBase(file))
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((d: { html?: string }) => {
        if (active) setState({ file, html: d.html ?? "" });
      })
      .catch(() => {
        if (active) setState({ file, html: "" });
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
  const releases = component?.releases ?? [];
  const [tag, setTag] = useState(releases[0]?.tag);
  const selected = releases.find((r) => r.tag === tag) ?? releases[0];

  let file: string | undefined;
  if (component) {
    if (view === "releases") {
      file = selected
        ? `/release-docs/${component.id}/releases/${selected.file}`
        : undefined;
    } else if (view === "changelog") {
      file = component.changelogFile
        ? `/release-docs/${component.id}/${component.changelogFile}`
        : undefined;
    } else {
      file = component.releaseNotesFile
        ? `/release-docs/${component.id}/${component.releaseNotesFile}`
        : undefined;
    }
  }

  const { html, loading } = useDocHtml(file);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">{t(REF_LABEL_KEY[view])}</h1>
          {view === "releases" && releases.length > 1 && (
            <Select value={selected?.tag} onValueChange={setTag}>
              <SelectTrigger size="sm" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {releases.map((r) => (
                  <SelectItem key={r.tag} value={r.tag}>
                    {r.tag}
                    {r.prerelease ? " (pre)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="mt-4">
          {loading ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-40 w-full" />
            </div>
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
