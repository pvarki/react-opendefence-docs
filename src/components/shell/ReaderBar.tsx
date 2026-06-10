import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { Locale } from "@shared/content-schema";
import { ContentsDrawer } from "@/components/shell/ContentsDrawer";

interface ReaderBarProps {
  locale: string;
  contentLocale: Locale;
  collection: string;
  bookLabel: string;
  breadcrumb?: string[];
  currentSlug?: string;
}

/**
 * Slim bar between header and reader: where-am-I breadcrumb plus the mobile
 * Contents trigger (desktop has the persistent sidebar instead).
 */
export function ReaderBar({
  locale,
  contentLocale,
  collection,
  bookLabel,
  breadcrumb,
  currentSlug,
}: ReaderBarProps) {
  // Mobile shows "Book · Page", desktop the full flattened path.
  const pageTitle = breadcrumb?.[breadcrumb.length - 1];

  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/50 px-4 md:px-6">
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
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
            <span className="hidden items-center gap-1 md:flex">
              {breadcrumb!.slice(0, -1).map((part) => (
                <span key={part} className="flex items-center gap-1">
                  <ChevronRight className="size-3" />
                  <span className="truncate">{part}</span>
                </span>
              ))}
            </span>
            <ChevronRight className="size-3 shrink-0" />
            <span className="truncate text-foreground">{pageTitle}</span>
          </>
        )}
      </nav>
      <ContentsDrawer
        locale={locale}
        contentLocale={contentLocale}
        collection={collection}
        currentSlug={currentSlug}
      />
    </div>
  );
}
