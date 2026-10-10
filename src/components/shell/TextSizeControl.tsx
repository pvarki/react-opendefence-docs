import { useTranslation } from "react-i18next";
import {
  useTextScaleIndex,
  setTextScaleIndex,
  TEXT_SCALE_STEPS,
} from "@/lib/textScale";
import { cn } from "@/lib/utils";

// Fixed px so the preview sizes ignore the text scale.
const PREVIEW_PX = [12, 14, 17, 20];

export function TextSizeControl() {
  const { t } = useTranslation();
  const index = useTextScaleIndex();

  return (
    <div
      role="radiogroup"
      aria-label={t("textSize.label")}
      className="grid grid-cols-4 gap-1 rounded-md bg-muted/60 p-1"
    >
      {TEXT_SCALE_STEPS.map((step, i) => (
        <button
          key={step}
          type="button"
          role="radio"
          aria-checked={i === index}
          aria-label={`${Math.round(step * 100)} %`}
          onClick={() => setTextScaleIndex(i)}
          className={cn(
            "flex h-8 items-center justify-center rounded font-semibold leading-none transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            i === index
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          style={{ fontSize: PREVIEW_PX[i] }}
        >
          A
        </button>
      ))}
    </div>
  );
}
