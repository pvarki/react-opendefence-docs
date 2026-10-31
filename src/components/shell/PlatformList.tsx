import type { ClientInfo } from "@shared/content-schema";
import { stripPlatformSuffix } from "@/lib/platform";
import { PlatformIcon, IncompleteBadge } from "@/components/shell/PlatformIcon";
import { cn } from "@/lib/utils";

interface PlatformListProps {
  options: ClientInfo[];
  activeId?: string;
  onPick: (option: ClientInfo) => void;
  variant?: "grid" | "chips";
  /**
   * Grid only: one row on wide screens. The book cover uses it so the
   * platforms and a draft banner do not push Start reading below the fold.
   */
  oneRowWide?: boolean;
}

/**
 * A book's selectable clients as a uniform grid (contents sheet, book
 * cover). OS suffixes are dropped — the icon tells the two TAK Trackers
 * apart. The active client is highlighted; clients whose Outline organizer
 * is flagged incomplete carry a red tag.
 */
export function PlatformList({
  options,
  activeId,
  onPick,
  variant = "grid",
  oneRowWide = false,
}: PlatformListProps) {
  if (variant === "chips") {
    return (
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.id === activeId;
          return (
            <li key={option.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onPick(option)}
                aria-pressed={active}
                aria-label={option.label}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "border-primary bg-primary/10 font-medium text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <PlatformIcon
                  platform={option.platform}
                  className="size-4 shrink-0"
                />
                {stripPlatformSuffix(option.label)}
                {option.underDevelopment && <IncompleteBadge />}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul
      className={cn(
        // Three columns once two columns would need a third row — the list
        // stays at most two rows for any realistic client count.
        "grid gap-1.5 sm:grid-cols-3 sm:gap-2",
        options.length > 4 ? "grid-cols-3" : "grid-cols-2",
        oneRowWide && "xl:grid-flow-col xl:auto-cols-fr xl:grid-cols-none",
      )}
    >
      {options.map((option) => (
        <li key={option.id}>
          <button
            type="button"
            onClick={() => onPick(option)}
            aria-pressed={option.id === activeId}
            aria-label={option.label}
            className={cn(
              "flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border px-2.5 text-xs transition-colors sm:h-11 sm:px-3 sm:text-sm",
              option.id === activeId
                ? "border-primary bg-muted font-medium text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground",
            )}
          >
            <PlatformIcon
              platform={option.platform}
              className="size-4 shrink-0"
            />
            <span className="truncate">
              {stripPlatformSuffix(option.label)}
            </span>
            {option.underDevelopment && <IncompleteBadge />}
          </button>
        </li>
      ))}
    </ul>
  );
}
