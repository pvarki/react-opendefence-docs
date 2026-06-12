import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { CardImage } from "@/lib/cardImages";
import { withBase } from "@/lib/base";

interface BookCardProps {
  locale: string;
  /** Route target: either a fixed route or the reader splat. */
  to: string;
  splat?: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Optional backdrop (public/images/...), tinted so text stays readable. */
  image?: CardImage;
}

/**
 * Compact section/book card: a low row so whole shelves fit one screen.
 * The optional background image fades out under a card-colored gradient
 * that is solid behind the text and reveals the image to the right.
 */
export function BookCard({
  locale,
  to,
  splat,
  icon: Icon,
  title,
  description,
  image,
}: BookCardProps) {
  return (
    <Link
      to={to}
      params={splat ? { locale, _splat: splat } : { locale }}
      className="group block focus-visible:outline-none"
    >
      <div className="relative flex h-[4.25rem] items-center gap-3 overflow-hidden rounded-xl border border-border bg-card px-3.5 transition-colors group-hover:border-primary group-focus-visible:ring-2 group-focus-visible:ring-ring md:h-20 md:px-4">
        {image &&
          (image.logo ? (
            // Brand marks: contained on the right, faint — never stretched.
            <img
              src={withBase(image.src)}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-y-2 right-3 h-[calc(100%-1rem)] w-2/5 object-contain object-right opacity-20"
            />
          ) : (
            <>
              <img
                src={withBase(image.src)}
                alt=""
                aria-hidden
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover object-[center_30%] opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-card via-card/85 to-card/25" />
            </>
          ))}
        <Icon className="relative size-5 shrink-0 text-primary" />
        <div className="relative min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          {description && (
            <p className="truncate text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
