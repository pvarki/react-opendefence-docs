import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";
import { cn } from "@/lib/utils";

/** Yellow-and-black hazard tape, the same in light and dark theme. */
const HAZARD_STRIPES =
  "bg-[repeating-linear-gradient(-45deg,var(--color-yellow-400)_0_24px,var(--color-black)_24px_48px)]";

/**
 * Non-blocking notice shown above content that hasn't met the quality bar yet.
 * Render it when the page, an organizer above it or the book carries the
 * draft marker in Outline (PageDoc / ManifestPage / ManifestCollection
 * underDevelopment, or the active client's).
 * `compact` is for book covers, where Start reading must stay above the fold.
 */
export function UnderConstructionBanner({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const stripes = cn(HAZARD_STRIPES, compact ? "h-4" : "h-8.5");
  return (
    <div
      role="note"
      className="mb-4 overflow-hidden rounded-lg border-2 border-black md:mb-6"
    >
      <div aria-hidden className={stripes} />
      <p
        className={cn(
          "flex items-center justify-center gap-2.5 bg-yellow-400 px-4 text-center leading-tight font-black tracking-wide text-black uppercase",
          compact ? "py-1.5 text-xl" : "py-3 text-[1.75rem] md:text-3xl",
        )}
      >
        <Construction
          className={cn(
            "hidden shrink-0 md:block",
            compact ? "size-6" : "size-8",
          )}
          aria-hidden
        />
        {t("reader.underConstruction.title")}
      </p>
      <div aria-hidden className={stripes} />
      <p
        className={cn(
          "bg-card px-4 text-foreground",
          compact ? "py-2 text-sm" : "py-3 text-base",
        )}
      >
        {t("reader.underConstruction.body")}
      </p>
    </div>
  );
}
