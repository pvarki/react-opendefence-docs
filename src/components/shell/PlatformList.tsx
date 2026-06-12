import type { ClientInfo } from "@shared/content-schema";
import { stripPlatformSuffix } from "@/lib/platform";
import { PlatformIcon, IncompleteBadge } from "@/components/shell/PlatformIcon";
import { cn } from "@/lib/utils";

interface PlatformListProps {
  options: ClientInfo[];
  activeId?: string;
  onPick: (option: ClientInfo) => void;
}

/**
 * A book's selectable clients as a uniform grid (contents sheet, book
 * cover). OS suffixes are dropped — the icon tells the two TAK Trackers
 * apart. The active client is highlighted; clients whose Outline organizer
 * is flagged incomplete carry a red tag.
 */
export function PlatformList({ options, activeId, onPick }: PlatformListProps) {
  return (
    <ul
      className={cn(
        // Three columns once two columns would need a third row — the list
        // stays at most two rows for any realistic client count.
        "grid gap-1.5 sm:grid-cols-3 sm:gap-2",
        options.length > 4 ? "grid-cols-3" : "grid-cols-2",
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
