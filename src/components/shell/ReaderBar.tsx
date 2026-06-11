import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

interface ReaderBarProps {
  locale: string;
  collection: string;
  bookLabel: string;
  breadcrumb?: string[];
}

/**
 * Where-am-I path, desktop only and deliberately tiny — content space is
 * the priority. Mobile gets its bearings from the bottom chapter bar.
 */
export function ReaderBar({
  locale,
  collection,
  bookLabel,
  breadcrumb,
}: ReaderBarProps) {
  const pageTitle = breadcrumb?.[breadcrumb.length - 1];

  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden h-7 shrink-0 items-center gap-1 border-b border-border/60 px-6 text-[11px] text-muted-foreground md:flex"
    >
      <Link
        to="/$locale/$"
        params={{ locale, _splat: collection }}
        className="shrink-0 hover:text-foreground"
      >
        {bookLabel}
      </Link>
      {pageTitle && (
        <>
          {breadcrumb!.slice(0, -1).map((part) => (
            <span key={part} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="size-3 shrink-0" />
              <span className="truncate">{part}</span>
            </span>
          ))}
          <ChevronRight className="size-3 shrink-0" />
          <span className="truncate text-foreground">{pageTitle}</span>
        </>
      )}
    </nav>
  );
}
