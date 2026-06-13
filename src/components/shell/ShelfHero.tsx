import { withBase } from "@/lib/base";
import { cn } from "@/lib/utils";

/**
 * Full-width shelf-page hero in the same style as the home page: a tinted
 * full-bleed image with the page title overlaid at the bottom.
 */
export function ShelfHero({
  src,
  title,
  position = "object-[center_30%]",
}: {
  src: string;
  title: string;
  /** Tailwind object-position class (e.g. "object-bottom"). */
  position?: string;
}) {
  return (
    <div className="relative h-40 overflow-hidden border-b border-border md:h-56">
      <img
        src={withBase(src)}
        alt=""
        aria-hidden
        className={cn("absolute inset-0 h-full w-full object-cover", position)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl px-4 pb-3 md:pb-5">
        <h1 className="text-2xl font-bold md:text-4xl">{title}</h1>
      </div>
    </div>
  );
}
