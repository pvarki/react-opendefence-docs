import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Tag } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { HtmlBlock } from "@/components/blocks/HtmlBlock";
import { withBase } from "@/lib/base";

// Mirrors scripts/fetch-release-docs.ts ReleaseDocsManifest. Exported so the
// generated route tree can name the loader's return type (see api.tsx).
export interface ReleaseEntry {
  tag: string;
  file: string;
  publishedAt?: string;
  prerelease?: boolean;
}
export interface ReleaseDocComponent {
  id: string;
  name: string;
  repo: string;
  releases: ReleaseEntry[];
  changelogFile?: string;
  releaseNotesFile?: string;
}
export interface ReleaseDocsManifest {
  components: ReleaseDocComponent[];
}

type TabKey = "releases" | "notes" | "changelog";

export const Route = createFileRoute("/$locale/dev/releases")({
  // Deep-linkable from the Develop shelf: ?c=<component-id>&tab=releases|changelog
  validateSearch: (
    search: Record<string, unknown>,
  ): { c?: string; tab?: TabKey } => ({
    c: typeof search.c === "string" ? search.c : undefined,
    tab:
      search.tab === "releases" ||
      search.tab === "changelog" ||
      search.tab === "notes"
        ? search.tab
        : undefined,
  }),
  loader: async (): Promise<ReleaseDocsManifest> => {
    try {
      const res = await fetch(withBase("/release-docs/manifest.json"));
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as ReleaseDocsManifest;
    } catch {
      return { components: [] };
    }
  },
  component: ReleasesPage,
});

function hasContent(c: ReleaseDocComponent): boolean {
  return c.releases.length > 0 || !!c.changelogFile || !!c.releaseNotesFile;
}

/** Lazily fetch a pre-rendered release-doc JSON ({ html }) by root-abs path. */
function useDocHtml(file: string | undefined): {
  html: string | undefined;
  loading: boolean;
} {
  // Keyed by file so a stale fetch never shows under a newly selected doc, and
  // setState only ever runs inside async callbacks (not the effect body).
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
  const loading = !!file && html === undefined;
  return { html, loading };
}

function ReleasesPage() {
  const manifest = Route.useLoaderData();
  const search = Route.useSearch();
  const components = manifest.components.filter(hasContent);
  const [compId, setCompId] = useState(
    search.c && components.some((c) => c.id === search.c)
      ? search.c
      : components[0]?.id,
  );
  const active = components.find((c) => c.id === compId) ?? components[0];

  if (!active) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-2xl font-bold">Releases</h1>
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-6 text-muted-foreground">
            <Tag className="size-5 text-primary" />
            No releases have been synced yet.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <h1 className="mr-2 text-sm font-semibold">Releases</h1>
        {components.length > 1 && (
          <Select value={active.id} onValueChange={setCompId}>
            <SelectTrigger size="sm" className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {components.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {/* Remount on component switch so version/tab state resets cleanly. */}
      <ComponentReleases
        key={active.id}
        component={active}
        initialTab={search.tab}
      />
    </div>
  );
}

function ComponentReleases({
  component,
  initialTab,
}: {
  component: ReleaseDocComponent;
  initialTab?: TabKey;
}) {
  const tabs: { key: TabKey; label: string }[] = [
    ...(component.releases.length > 0
      ? [{ key: "releases" as const, label: "Release notes" }]
      : []),
    ...(component.releaseNotesFile
      ? [{ key: "notes" as const, label: "Notes" }]
      : []),
    ...(component.changelogFile
      ? [{ key: "changelog" as const, label: "Changelog" }]
      : []),
  ];
  const [tab, setTab] = useState<TabKey>(
    initialTab && tabs.some((t) => t.key === initialTab)
      ? initialTab
      : (tabs[0]?.key ?? "releases"),
  );
  const [tag, setTag] = useState(component.releases[0]?.tag);
  const selectedRelease =
    component.releases.find((r) => r.tag === tag) ?? component.releases[0];

  let file: string | undefined;
  if (tab === "releases") {
    file = selectedRelease
      ? `/release-docs/${component.id}/releases/${selectedRelease.file}`
      : undefined;
  } else if (tab === "changelog") {
    file = component.changelogFile
      ? `/release-docs/${component.id}/${component.changelogFile}`
      : undefined;
  } else {
    file = component.releaseNotesFile
      ? `/release-docs/${component.id}/${component.releaseNotesFile}`
      : undefined;
  }

  const { html, loading } = useDocHtml(file);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              {tabs.map((t) => (
                <TabsTrigger key={t.key} value={t.key}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {tab === "releases" && component.releases.length > 1 && (
              <Select value={selectedRelease?.tag} onValueChange={setTag}>
                <SelectTrigger size="sm" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {component.releases.map((r) => (
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
                Nothing to show here yet.
              </p>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
