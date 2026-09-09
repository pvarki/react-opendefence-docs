import { Suspense, lazy, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2 } from "lucide-react";
import { BlockAction } from "@/components/blocks/BlockAction";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const DiagramZoom = lazy(() => import("@/components/blocks/DiagramZoom"));

// Mermaid is a heavy library, so it is dynamically imported (its own chunk) and
// only loaded on pages that actually contain a diagram. Initialized once.
let initialized = false;

/** Renders a mermaid diagram client-side; falls back to the source on error. */
export function MermaidBlock({
  code,
  title,
}: {
  code: string;
  title?: string;
}) {
  const { t } = useTranslation();
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const id = "mmd-" + useId().replace(/[^a-zA-Z0-9-]/g, "");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        if (!initialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            securityLevel: "strict",
            fontFamily: "inherit",
          });
          initialized = true;
        }
        const rendered = await mermaid.render(id, code);
        if (active) setSvg(rendered.svg);
      } catch {
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [code, id]);

  if (error) {
    return (
      <pre className="my-6 overflow-x-auto rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <figure className="relative my-6 rounded-lg border border-border bg-card p-4">
      <div className="overflow-x-auto">
        <div
          className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg ?? "" }}
        />
      </div>
      {title && (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground">
          {title}
        </figcaption>
      )}
      {svg && (
        <BlockAction
          icon={Maximize2}
          label={t("blocks.expandDiagram")}
          onClick={() => setExpanded(true)}
        />
      )}

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          data-swipe-scope="diagram"
          showCloseButton
          className="h-[95dvh] w-[95vw] max-w-none p-0 sm:max-w-none"
        >
          <DialogTitle className="sr-only">
            {title ?? t("blocks.diagram")}
          </DialogTitle>
          <DialogDescription className="sr-only" />
          <Suspense fallback={null}>
            {expanded && svg && <DiagramZoom svg={svg} />}
          </Suspense>
        </DialogContent>
      </Dialog>
    </figure>
  );
}
