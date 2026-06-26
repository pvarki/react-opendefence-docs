import { useState } from "react";
import { useParams, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Info, Maximize2 } from "lucide-react";
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
import { useReaderData } from "@/lib/useReaderData";
import { stripBase, withBase } from "@/lib/base";
import { cn } from "@/lib/utils";

const SEEN_KEY = "od-intro-seen-v1";

const SLIDES = [
  { key: "slide1", img: "/images/onboarding/welcome.png" },
  { key: "slide2", img: "/images/onboarding/products.png" },
  { key: "slide3", img: "/images/onboarding/docs.png" },
] as const;

function introSeen(): boolean {
  try {
    return !!localStorage.getItem(SEEN_KEY);
  } catch {
    // private mode / storage blocked
    return false;
  }
}

/**
 * First-visit welcome modal: three slides telling the OpenDefence story.
 * Auto-opens once on the homepage (localStorage-gated), and stays reachable
 * everywhere via a fixed bottom-left button so it can be revisited. A Drawer
 * on mobile, a Dialog on desktop — like react-rasenmaeher-ui-v2's onboarding.
 * Each slide image opens fullscreen on click.
 */
export function IntroModal() {
  const { t } = useTranslation();
  const params = useParams({ strict: false });
  const locale = params.locale ?? DEFAULT_LOCALE;
  const pathname = useRouterState({
    select: (s) => stripBase(s.location.pathname),
  });
  const isHome = pathname.replace(/\/$/, "") === `/${locale}`;
  const inReader = !!useReaderData();
  const isMobile = useIsMobile();

  // Open once on the homepage when never seen. Closing marks it seen, so it
  // never reappears unless reopened from the button. Lazy init (not an
  // effect) — IntroModal mounts once at root.
  const [open, setOpen] = useState(() => isHome && !introSeen());
  const [step, setStep] = useState(0);
  const [enlarged, setEnlarged] = useState(false);

  const markSeen = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // ignore
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) markSeen();
  };

  const reopen = () => {
    setStep(0);
    setOpen(true);
  };

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const imageSrc = withBase(slide.img);
  const title = t(`intro.${slide.key}.title`);

  // Shared slide body for both the desktop Dialog and the mobile Drawer.
  const content = (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setEnlarged(true)}
        aria-label={t("slides.fullscreen")}
        className="group relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted/30 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img
          src={imageSrc}
          alt=""
          aria-hidden
          className="h-full w-full object-contain"
        />
        <span className="absolute top-2 right-2 rounded-md bg-black/50 p-1.5 text-white opacity-70 transition-opacity group-hover:opacity-100">
          <Maximize2 className="size-4" />
        </span>
      </button>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t(`intro.${slide.key}.body`)}
      </p>
      {isLast && (
        <p className="text-xs text-muted-foreground/70">
          {t("intro.slide3.contact")}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex gap-2">
          <Button
            size="lg"
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ChevronLeft />
            {t("intro.back")}
          </Button>
          <Button
            size="lg"
            onClick={() =>
              isLast ? handleOpenChange(false) : setStep((s) => s + 1)
            }
          >
            {isLast ? t("intro.finish") : t("intro.next")}
            <ChevronRight />
          </Button>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {SLIDES.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                i === step ? "bg-primary" : "bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Fullscreen image viewer — click anywhere to dismiss. */}
      <Dialog open={enlarged} onOpenChange={setEnlarged}>
        <DialogContent
          showCloseButton={false}
          onClick={() => setEnlarged(false)}
          className="flex h-[95vh] max-w-[95vw] items-center justify-center border-none bg-black/95 p-2 sm:max-w-[95vw]"
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only" />
          <img
            src={imageSrc}
            alt={title}
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
        </DialogContent>
      </Dialog>

      {isMobile ? (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerTitle className="sr-only">{title}</DrawerTitle>
            <DrawerDescription className="sr-only" />
            <div className="overflow-y-auto p-4 pb-8">{content}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-y-auto">
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <DialogDescription className="sr-only" />
            {content}
          </DialogContent>
        </Dialog>
      )}

      {/* Revisit button — bottom-left, above the mobile tab bar. Hidden on
          mobile reader pages where the floating back button sits at left-3. */}
      <button
        type="button"
        onClick={reopen}
        className={cn(
          "fixed bottom-4 left-4 z-40 flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur transition-colors hover:border-primary hover:text-primary max-md:bottom-[calc(var(--tabbar-h)+0.75rem)] max-md:left-3",
          inReader && "max-md:hidden",
        )}
      >
        <Info className="size-4 text-primary" />
        {t("intro.revisit")}
      </button>
    </>
  );
}
