import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";

/**
 * Renders pipeline-emitted HTML. Safe without runtime sanitization because the
 * sync pipeline sanitizes with rehype-sanitize at build time. Internal links
 * are intercepted and routed through the SPA router.
 */
export function HtmlBlock({ html }: { html: string }) {
  const router = useRouter();

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || anchor.target === "_blank")
        return;
      e.preventDefault();
      void router.navigate({ to: href });
    },
    [router],
  );

  return (
    <div
      className="prose prose-invert max-w-none"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
