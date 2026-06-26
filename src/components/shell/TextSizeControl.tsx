import { useTranslation } from "react-i18next";
import { AArrowDown, AArrowUp } from "lucide-react";
import {
  useTextScaleIndex,
  setTextScaleIndex,
  TEXT_SCALE_MIN,
  TEXT_SCALE_MAX,
} from "@/lib/textScale";
import { cn } from "@/lib/utils";

/**
 * Smaller / larger text control for the navbar. Visible on mobile too (the
 * Header is). Scales all rem-based text site-wide via the --text-scale root
 * variable; the slideset adapts its image size separately at large steps.
 */
export function TextSizeControl() {
  const { t } = useTranslation();
  const index = useTextScaleIndex();

  const btn =
    "flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40";

  return (
    <div
      role="group"
      aria-label={t("textSize.label")}
      className="flex items-center rounded-md border border-input"
    >
      <button
        type="button"
        onClick={() => setTextScaleIndex(index - 1)}
        disabled={index <= TEXT_SCALE_MIN}
        aria-label={t("textSize.smaller")}
        className={cn(btn, "rounded-l-md")}
      >
        <AArrowDown className="size-4" />
      </button>
      <span className="h-4 w-px bg-border" aria-hidden />
      <button
        type="button"
        onClick={() => setTextScaleIndex(index + 1)}
        disabled={index >= TEXT_SCALE_MAX}
        aria-label={t("textSize.larger")}
        className={cn(btn, "rounded-r-md")}
      >
        <AArrowUp className="size-5" />
      </button>
    </div>
  );
}
