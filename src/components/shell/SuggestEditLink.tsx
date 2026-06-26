import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { suggestEditUrl } from "@/lib/guideLinks";
import { cn } from "@/lib/utils";

/**
 * "Suggest an edit →" — opens a prefilled GitHub issue for this page. Anyone
 * with a GitHub account can propose a change; a maintainer applies it in
 * Outline. Sits beside {@link GuideIssuesLink} in the page footer.
 */
export function SuggestEditLink({
  collection,
  title,
  docId,
  className,
}: {
  collection: string;
  title: string;
  docId?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  // Footer renders on inert neighbor panes too, but only the current (active)
  // pane is interactive — so location.href is the right page when clicked.
  const pageUrl = typeof window === "undefined" ? "" : window.location.href;
  return (
    <a
      href={suggestEditUrl({ collection, title, pageUrl, docId })}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <Pencil className="size-3.5 shrink-0" />
      <span>{t("suggestEdit")}</span>
    </a>
  );
}
