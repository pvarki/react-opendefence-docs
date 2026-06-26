import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DEFAULT_LOCALE } from "@shared/content-schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  FLOWS,
  SELECTOR,
  type Option,
  type TrackKey,
} from "@/lib/orientationFlows";

const optionClass =
  "flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3.5 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * RPG-style orientation flow: a short branching questionnaire that ends by
 * routing the visitor to a relevant doc page. The home "doors" open it directly
 * into a track (contribute/integrate/operate); the /dev shelf opens it on the
 * track selector. Dialog on desktop, Drawer on mobile — mirrors IntroModal.
 */
export function OrientationModal({
  open,
  start,
  onOpenChange,
}: {
  open: boolean;
  start: TrackKey | "selector";
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const params = useParams({ strict: false });
  const locale = params.locale ?? DEFAULT_LOCALE;
  const isMobile = useIsMobile();

  const [track, setTrack] = useState<TrackKey | null>(
    start === "selector" ? null : start,
  );
  const [qIndex, setQIndex] = useState(0);
  const [chosen, setChosen] = useState<Option | null>(null);

  // Reset to the start whenever the modal (re)opens. Render-phase update (not an
  // effect): React discards this render and re-runs with fresh state, no flicker.
  const [session, setSession] = useState<TrackKey | "selector" | null>(
    open ? start : null,
  );
  if (open && session !== start) {
    setSession(start);
    setTrack(start === "selector" ? null : start);
    setQIndex(0);
    setChosen(null);
  } else if (!open && session !== null) {
    setSession(null);
  }

  const onSelector = track === null;
  const question = track ? FLOWS[track][qIndex] : SELECTOR;
  const headerTitleKey = onSelector
    ? "orient.selector.title"
    : `orient.${track}.title`;
  const headerLeadKey = onSelector ? undefined : `orient.${track}.lead`;
  // A chosen link option shows a confirmation before navigating; everything else
  // reveals an info/transition body in place.
  const chosenTarget = chosen?.target;
  const bodyKey =
    chosen && !chosenTarget
      ? onSelector
        ? "orient.selector.transition"
        : chosen.bodyKey
      : undefined;

  const choose = (opt: Option) => {
    if (opt.close) {
      onOpenChange(false);
      return;
    }
    setChosen(opt); // info, track, or link option → revealed/confirmed in place
  };

  const goNext = () => {
    if (onSelector && chosen?.track) {
      setTrack(chosen.track);
      setQIndex(0);
      setChosen(null);
      return;
    }
    if (!track) return;
    setChosen(null);
    setQIndex((i) => Math.min(i + 1, FLOWS[track].length - 1));
  };

  const goBack = () => {
    if (chosen) {
      setChosen(null);
      return;
    }
    if (track && qIndex > 0) {
      setQIndex((i) => i - 1);
      return;
    }
    if (track && start === "selector") {
      setTrack(null); // back to the track selector
      return;
    }
    onOpenChange(false); // first screen → close
  };

  const headerTitle = t(headerTitleKey);

  const content = (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">{headerTitle}</h2>
        {headerLeadKey && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t(headerLeadKey)}
          </p>
        )}
      </div>

      {chosenTarget ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("orient.confirm")}
          </p>
          <p className="text-base font-semibold text-foreground">
            {t(chosen!.key)}
          </p>
        </div>
      ) : bodyKey ? (
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
          {t(bodyKey)}
        </p>
      ) : (
        <>
          <p className="text-base font-semibold">{t(question.promptKey)}</p>
          {question.leadKey && (
            <p className="-mt-2 text-sm leading-relaxed text-muted-foreground">
              {t(question.leadKey)}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {question.options.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => choose(opt)}
                className={optionClass}
              >
                <span>{t(opt.key)}</span>
                {opt.target && (
                  <ChevronRight className="size-4 shrink-0 opacity-60" />
                )}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        {track ? (
          <div className="flex gap-1.5" aria-hidden>
            {FLOWS[track].map((q, i) => (
              <span
                key={q.promptKey}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  i === qIndex ? "bg-primary" : "bg-muted-foreground/30",
                )}
              />
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={goBack}>
            <ChevronLeft />
            {t("orient.back")}
          </Button>
          {chosenTarget ? (
            <Button asChild>
              <Link
                to={chosenTarget.to}
                params={
                  chosenTarget.splat
                    ? { locale, _splat: chosenTarget.splat }
                    : { locale }
                }
                onClick={() => onOpenChange(false)}
              >
                {t("orient.continue")}
                <ChevronRight />
              </Link>
            </Button>
          ) : (
            bodyKey && (
              <Button onClick={goNext}>
                {t("orient.continue")}
                <ChevronRight />
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );

  return isMobile ? (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerTitle className="sr-only">{headerTitle}</DrawerTitle>
        <DrawerDescription className="sr-only" />
        <div className="overflow-y-auto p-4 pb-8">{content}</div>
      </DrawerContent>
    </Drawer>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-y-auto">
        <DialogTitle className="sr-only">{headerTitle}</DialogTitle>
        <DialogDescription className="sr-only" />
        {content}
      </DialogContent>
    </Dialog>
  );
}
