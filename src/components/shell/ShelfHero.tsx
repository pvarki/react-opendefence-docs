import type { ReactNode } from "react";
import { PAGE_FRAME } from "@/lib/pageFrame";
import { ShelfIndicator } from "@/components/shell/ShelfIndicator";
import { cn } from "@/lib/utils";

export function ShelfHero({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn(PAGE_FRAME, "pt-6 md:pt-10", className)}>
      <ShelfIndicator className="-ml-1 mb-1" />
      <h1 className="text-2xl font-bold tracking-tight break-words md:text-3xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground md:text-base">
          {subtitle}
        </p>
      )}
    </header>
  );
}
