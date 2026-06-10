import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SlidesetBlock } from "@shared/content-schema";
import { Lightbox } from "@/components/slides/Lightbox";

/**
 * Mobile rendering of a slideset: a vertical numbered step list. Deliberately
 * NOT a carousel and NOT a data-swipe-scope — plain scrolling must never
 * steal page-turn gestures (the historical nested-gesture failure mode).
 */
export function StepList({ block }: { block: SlidesetBlock }) {
  const { t } = useTranslation();
  const [enlarged, setEnlarged] = useState<{ src: string; alt?: string }>();

  return (
    <section className="my-8">
      {block.title && (
        <h3 className="mb-4 text-lg font-semibold">{block.title}</h3>
      )}
      <ol className="space-y-6">
        {block.slides.map((slide, i) => (
          <li
            key={i}
            className="rounded-xl border border-border bg-card p-4 md:p-6"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {t("slides.stepOf", {
                  current: i + 1,
                  total: block.slides.length,
                })}
              </span>
            </div>
            {slide.title && (
              <h4 className="mb-2 font-semibold">{slide.title}</h4>
            )}
            {slide.images.map((image) => (
              <button
                key={image.src}
                type="button"
                className="mb-3 block w-full"
                onClick={() => setEnlarged({ src: image.src, alt: image.alt })}
              >
                <img
                  src={image.src}
                  alt={image.alt ?? slide.title ?? ""}
                  width={image.width}
                  height={image.height}
                  loading="lazy"
                  className="w-full rounded-lg border border-border bg-muted/20 object-contain"
                />
              </button>
            ))}
            <div
              className="prose prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: slide.html }}
            />
          </li>
        ))}
      </ol>
      <Lightbox
        src={enlarged?.src}
        alt={enlarged?.alt}
        onClose={() => setEnlarged(undefined)}
      />
    </section>
  );
}
