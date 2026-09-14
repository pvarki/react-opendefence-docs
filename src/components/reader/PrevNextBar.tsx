import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PagePosition } from "@/lib/content/neighbors";
import { cn } from "@/lib/utils";

/**
 * Always-rendered link navigation. Swiping is an enhancement; these real
 * links are the accessibility and no-gesture baseline.
 */
export function PrevNextBar({
  locale,
  position,
  sticky = false,
}: {
  locale: string;
  position: PagePosition;
  /**
   * Pin to the bottom of the pane. A slideset fills the screen and carries its
   * own forward control, so the bar can sit at the end of the article; a video
   * is a short 16:9 box, which leaves this below the fold on a page whose only
   * way onward it is.
   */
  sticky?: boolean;
}) {
  const { t } = useTranslation();

  // 44px minimum touch target (WCAG 2.5.5). min-w-0 + truncate keep a long
  // page title from pushing the row wider than the pane.
  const side =
    "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary";

  return (
    <nav
      className={cn(
        "mt-10 flex items-center justify-between gap-2 border-t border-border pt-4",
        // The negative margins cancel the pane's own padding so the pinned bar
        // spans its full width, matching how the tab bar reads over content.
        sticky &&
          "sticky bottom-0 z-10 -mx-4 bg-background/95 px-4 pb-2 backdrop-blur md:-mx-8 md:px-8",
      )}
    >
      {position.prev ? (
        <Link
          to="/$locale/$"
          params={{
            locale,
            _splat: `${position.prev.collection}/${position.prev.slug}`,
          }}
          className={side}
          aria-label={t("reader.previous")}
        >
          <ChevronLeft className="size-5 shrink-0" />
          <span className="truncate">{position.prev.title}</span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
      <span className="shrink-0 px-1 text-xs text-muted-foreground tabular-nums">
        {t("reader.pageOf", {
          current: position.index + 1,
          total: position.total,
        })}
      </span>
      {position.next ? (
        <Link
          to="/$locale/$"
          params={{
            locale,
            _splat: `${position.next.collection}/${position.next.slug}`,
          }}
          className={cn(side, "justify-end")}
          aria-label={t("reader.next")}
        >
          <span className="truncate">{position.next.title}</span>
          <ChevronRight className="size-5 shrink-0" />
        </Link>
      ) : (
        <span className="flex-1" />
      )}
    </nav>
  );
}
