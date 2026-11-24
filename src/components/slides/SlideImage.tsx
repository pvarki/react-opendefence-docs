import type { Slide } from "@shared/content-schema";
import { cn } from "@/lib/utils";
import { useImageLoaded } from "@/components/slides/useImagePreloader";

/** A slide's screenshot: a spinner until it has loaded, then a fade-in. */
export function SlideImage({
  image,
  fallbackAlt,
  className,
  spinnerClassName,
}: {
  image: Slide["images"][number];
  fallbackAlt?: string;
  className?: string;
  spinnerClassName?: string;
}) {
  const loaded = useImageLoaded(image.src);
  return (
    <>
      {!loaded && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "animate-spin rounded-full border-2 border-primary border-t-transparent",
              spinnerClassName,
            )}
          />
        </span>
      )}
      <img
        src={image.src}
        alt={image.alt ?? fallbackAlt ?? ""}
        width={image.width}
        height={image.height}
        className={cn(
          "object-contain transition-opacity",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    </>
  );
}
