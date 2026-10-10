import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DEFAULT_LOCALE } from "@shared/content-schema";
import { stripBase } from "@/lib/base";
import { SHELF_LABEL_KEYS, SHELF_STOPS, shelfStopIndex } from "@/lib/shelfNav";
import { cn } from "@/lib/utils";

export function ShelfIndicator({ className }: { className?: string }) {
  const { t } = useTranslation();
  const params = useParams({ strict: false });
  const locale = params.locale ?? DEFAULT_LOCALE;
  const pathname = useRouterState({
    select: (s) => stripBase(s.location.pathname),
  });
  const current = shelfStopIndex(pathname, locale);
  if (current < 0) return null;

  return (
    <nav aria-label={t("nav.shelves")} className={className}>
      <ol className="flex items-center">
        {SHELF_STOPS.map((stop, i) => (
          <li key={stop.id} className="flex">
            <Link
              to={(stop.path ? `/$locale/${stop.path}` : "/$locale") as string}
              params={{ locale }}
              aria-label={t(SHELF_LABEL_KEYS[stop.id])}
              aria-current={i === current ? "page" : undefined}
              className="flex h-6 min-w-6 items-center justify-center px-0.5"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all",
                  i === current
                    ? "w-5 bg-primary"
                    : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground",
                )}
              />
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
