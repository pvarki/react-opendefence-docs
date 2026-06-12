import type { ClientInfo } from "@shared/content-schema";
import { PlatformIcon, IncompleteBadge } from "@/components/shell/PlatformIcon";
import { cn } from "@/lib/utils";

interface PlatformListProps {
  options: ClientInfo[];
  activeId?: string;
  onPick: (option: ClientInfo) => void;
}

/**
 * A book's selectable clients as tappable pills (contents sheet, book
 * cover). The active one is highlighted; clients whose Outline organizer is
 * flagged incomplete carry a red tag.
 */
export function PlatformList({ options, activeId, onPick }: PlatformListProps) {
  return (
    <ul className="flex flex-wrap gap-2">
      {options.map((option) => (
        <li key={option.id}>
          <button
            type="button"
            onClick={() => onPick(option)}
            aria-pressed={option.id === activeId}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
              option.id === activeId
                ? "border-primary bg-muted font-medium text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground",
            )}
          >
            <PlatformIcon platform={option.platform} className="size-4" />
            {option.label}
            {option.underDevelopment && <IncompleteBadge />}
          </button>
        </li>
      ))}
    </ul>
  );
}
