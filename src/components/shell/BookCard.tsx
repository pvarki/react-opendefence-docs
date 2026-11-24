import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Construction, type LucideIcon } from "lucide-react";
import type { CardImage } from "@/lib/cardImages";
import { cn } from "@/lib/utils";
import { withBase } from "@/lib/base";

interface BookCardProps {
  locale: string;
  /** Internal route target (a fixed route or the reader splat). */
  to?: string;
  splat?: string;
  /** External URL — when set the card opens it in a new tab instead of routing. */
  href?: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Brand mark from public/images/. */
  image?: CardImage;
  /** "tall" for sparse pages (home); default stays shelf-compact. */
  size?: "default" | "tall";
  /** Marks a book or shelf that carries the "Under construction" notice. */
  underConstruction?: boolean;
}

/**
 * Compact section/book card: a low row so whole shelves fit one screen.
 * Pass `href` for an external card (opens in a new tab); otherwise `to`.
 */
export function BookCard({
  locale,
  to,
  splat,
  href,
  icon: Icon,
  title,
  description,
  image,
  size = "default",
  underConstruction = false,
}: BookCardProps) {
  const { t } = useTranslation();
  const wrapperClass = "group block h-full focus-visible:outline-none";
  const inner = (
    <div
      className={cn(
        "flex h-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 transition-colors group-hover:border-primary group-focus-visible:ring-2 group-focus-visible:ring-ring md:px-4",
        size === "tall" ? "min-h-20 md:min-h-24" : "min-h-17 md:min-h-20",
      )}
    >
      <Icon className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-semibold">
          <span className="min-w-0 truncate">{title}</span>
          {underConstruction && (
            <span className="flex shrink-0 items-center gap-1 rounded-sm bg-yellow-400 px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-wide text-black uppercase">
              <Construction className="size-3" aria-hidden />
              {t("reader.underConstruction.title")}
            </span>
          )}
        </p>
        {description && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {image && (
        <img
          src={withBase(image.src)}
          alt=""
          aria-hidden
          loading="lazy"
          className="size-8 shrink-0 object-contain opacity-80 md:size-9"
        />
      )}
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={wrapperClass}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link
      to={to ?? "/$locale"}
      params={splat ? { locale, _splat: splat } : { locale }}
      className={wrapperClass}
    >
      {inner}
    </Link>
  );
}
