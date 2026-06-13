import { useEffect, useId, useRef, useState } from "react";

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
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
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
        const { svg } = await mermaid.render(id, code);
        if (active && ref.current) ref.current.innerHTML = svg;
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
    <figure className="my-6 overflow-x-auto rounded-lg border border-border bg-card p-4">
      <div
        ref={ref}
        className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full"
      />
      {title && (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground">
          {title}
        </figcaption>
      )}
    </figure>
  );
}
