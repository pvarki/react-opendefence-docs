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
 * underDevelopment, or the active client's), or when its section is under
 * construction (config/collections.ts).
 * `compact` is for book covers, where Start reading must stay above the fold;
 * `line` for step guides, whose slideset shares the first screen with it.
 */
export function UnderConstructionBanner({
  size = "full",
}: {
  size?: "full" | "compact" | "line";
}) {
  const { t } = useTranslation();
  if (size === "line") {
    return (
      <p
        role="note"
        title={t("reader.underConstruction.body")}
        className="mb-2 flex items-center justify-center gap-2 rounded-md border-2 border-black bg-yellow-400 px-3 py-1 text-center text-sm leading-tight font-black tracking-wide text-black uppercase"
      >
        <Construction className="size-4 shrink-0" aria-hidden />
        {t("reader.underConstruction.title")}
        <span className="sr-only">{t("reader.underConstruction.body")}</span>
      </p>
    );
  }
  const compact = size === "compact";
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
