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
          className="flex min-w-0 flex-1 basis-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          aria-label={`${t("reader.previousPage")}: ${position.prev.title}`}
        >
          <ChevronLeft className="size-4 shrink-0" />
          <span className="min-w-0">
            <span className="block text-xs">{t("reader.previousPage")}</span>
            <span className="block truncate text-foreground">
              {position.prev.title}
            </span>
          </span>
        </Link>
      ) : (
        <span className="flex-1 basis-0" />
      )}
      <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline">
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
          className="flex min-w-0 flex-1 basis-0 items-center justify-end gap-2 text-right text-sm text-muted-foreground hover:text-foreground"
          aria-label={`${t("reader.nextPage")}: ${position.next.title}`}
        >
          <span className="min-w-0">
            <span className="block text-xs">{t("reader.nextPage")}</span>
            <span className="block truncate text-foreground">
              {position.next.title}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0" />
        </Link>
      ) : (
        <span className="flex-1 basis-0" />
      )}
    </nav>
  );
}
