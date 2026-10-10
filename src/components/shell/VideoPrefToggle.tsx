import { useTranslation } from "react-i18next";
import { Switch } from "radix-ui";
import { GalleryVerticalEnd, Play } from "lucide-react";
import { useMediaPref, setMediaPref } from "@/lib/videoPref";
import { cn } from "@/lib/utils";

/**
 * Slides / videos knob for the navbar.
 *
 * The flanking icons are hidden below sm: at 320px the header's right-hand
 * cluster is already wide enough that their 44px squeezes the logo — which is
 * also the home link — down to nothing. The switch keeps its accessible name,
 * which says what turning it on does, so it is still usable without them.
 */
export function VideoPrefToggle() {
  const { t } = useTranslation();
  const pref = useMediaPref();
  const isVideos = pref === "videos";

  const iconCls = "hidden size-4 shrink-0 sm:block";

  return (
    <div className="flex items-center gap-1.5" title={t("media.label")}>
      <GalleryVerticalEnd
        className={cn(
          iconCls,
          isVideos ? "text-muted-foreground" : "text-foreground",
        )}
        aria-hidden
      />
      <Switch.Root
        checked={isVideos}
        onCheckedChange={(checked) =>
          setMediaPref(checked ? "videos" : "slides")
        }
        aria-label={t("media.label")}
        className="relative h-5 w-9 shrink-0 rounded-full border border-input bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=checked]:bg-primary"
      >
        <Switch.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-[18px]" />
      </Switch.Root>
      <Play
        className={cn(
          iconCls,
          isVideos ? "text-foreground" : "text-muted-foreground",
        )}
        aria-hidden
      />
    </div>
  );
}
