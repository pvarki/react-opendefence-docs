import { useTranslation } from "react-i18next";
import type { SlidesetBlock } from "@shared/content-schema";

/**
 * Step-by-step guide block. M4 adds the desktop Embla SlideDeck; until then
 * both form factors get the vertical step list (which remains the permanent
 * mobile rendering — deliberately not a carousel, and deliberately NOT a
 * data-swipe-scope: a plain list must not steal page-turn gestures).
 */
export function Slideset({ block }: { block: SlidesetBlock }) {
  const { t } = useTranslation();

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
            {slide.images[0] && (
              <img
                src={slide.images[0].src}
                alt={slide.images[0].alt ?? slide.title ?? ""}
                width={slide.images[0].width}
                height={slide.images[0].height}
                loading="lazy"
                className="mb-3 w-full rounded-lg border border-border bg-muted/20 object-contain"
              />
            )}
            <div
              className="prose prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: slide.html }}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
