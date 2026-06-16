import { Suspense, lazy, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Braces } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { withBase } from "@/lib/base";

export interface SpecVersion {
  tag: string;
  specFile: string;
}

export interface SpecManifest {
  sources: { id: string; name: string; versions: SpecVersion[] }[];
}

// Scalar is a heavy chunk: loaded only on this route, bundled (not CDN) so
// the reference works in air-gapped deployments.
const ApiReference = lazy(() =>
  import("@scalar/api-reference-react").then((m) => ({
    default: m.ApiReferenceReact,
  })),
);

export const Route = createFileRoute("/$locale/dev/api")({
  loader: async (): Promise<SpecManifest> => {
    try {
      const res = await fetch(withBase("/api-specs/manifest.json"));
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as SpecManifest;
    } catch {
      return { sources: [] };
    }
  },
  component: ApiReferencePage,
});

function ApiReferencePage() {
  const { t } = useTranslation();
  const manifest = Route.useLoaderData();
  const all = manifest.sources.flatMap((source) =>
    source.versions.map((v) => ({
      key: `${source.id}/${v.tag}`,
      label: `${source.name} (${v.tag})`,
      // Specs live at /api-specs/{id}/{file}; a bare filename would resolve
      // relative to the current route and hit the SPA fallback (HTML, not JSON).
      specUrl: `/api-specs/${source.id}/${v.specFile}`,
    })),
  );
  const [selected, setSelected] = useState(all[0]?.key);
  const active = all.find((s) => s.key === selected) ?? all[0];

  if (all.length === 0) {
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
      {all.length > 1 && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
          <Select value={active?.key} onValueChange={setSelected}>
            <SelectTrigger size="sm" className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {all.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {active && (
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
                url: withBase(active.specUrl),
                hideDarkModeToggle: true,
                forceDarkModeState: "dark",
                hideClientButton: true,
                // Scalar shows its Configure/Share/Deploy toolbar on localhost
                // by default; we never want it in the embedded reader.
                showDeveloperTools: "never",
              }}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
