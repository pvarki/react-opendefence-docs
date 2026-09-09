import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function BlockAction({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute top-2 right-2 rounded-md border border-border bg-card/80 p-1.5 text-muted-foreground opacity-70 backdrop-blur transition hover:text-foreground hover:opacity-100"
    >
      <Icon className={cn("size-4", active && "text-primary")} />
    </button>
  );
}
