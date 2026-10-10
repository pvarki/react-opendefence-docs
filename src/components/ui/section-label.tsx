import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionLabel({
  as: Tag = "h2",
  className,
  children,
}: {
  as?: "h2" | "h3" | "p" | "span";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={cn(
        "text-[11px] font-semibold tracking-widest text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
