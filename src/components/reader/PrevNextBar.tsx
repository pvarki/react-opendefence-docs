import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PagePosition } from "@/lib/content/neighbors";

/**
 * Always-rendered link navigation. Swiping is an enhancement; these real
 * links are the accessibility and no-gesture baseline.
 */
export function PrevNextBar({
  locale,
  position,
}: {
  locale: string;
  position: PagePosition;
}) {
  const { t } = useTranslation();

  return (
    <nav className="mt-12 flex items-center justify-between gap-4 border-t border-border pt-6">
      {position.prev ? (
        <Link
          to="/$locale/$"
          params={{
            locale,
            _splat: `${position.prev.collection}/${position.prev.slug}`,
          }}
          className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          aria-label={t("reader.previous")}
        >
          <ChevronLeft className="size-4 shrink-0" />
          <span className="truncate">{position.prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
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
          className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          aria-label={t("reader.next")}
        >
          <span className="truncate">{position.next.title}</span>
          <ChevronRight className="size-4 shrink-0" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
