import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import {
  PLATFORMS,
  type Platform,
  type PlatformInfo,
} from "@shared/content-schema";
import { PLATFORM_LABELS, setPlatform, usePlatform } from "@/lib/platform";
import { readingOrder } from "@/lib/content/neighbors";
import type { ReaderData } from "@/routes/$locale/$";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface PlatformSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  reader: ReaderData;
}

/**
 * Mobile platform picker (bottom-bar item). Picking a platform while reading
 * a page that doesn't exist there continues at that platform's first page of
 * the current book — the selection always lands somewhere readable.
 */
export function PlatformSheet({
  open,
  onOpenChange,
  locale,
  reader,
}: PlatformSheetProps) {
  const { t } = useTranslation();
  const active = usePlatform();
  const navigate = useNavigate();

  const bookPlatforms = reader.manifest.collections.find(
    (c) => c.slug === reader.collection,
  )?.platforms;
  const options: PlatformInfo[] =
    bookPlatforms && bookPlatforms.length > 0
      ? bookPlatforms
      : PLATFORMS.map((key) => ({ key, label: PLATFORM_LABELS[key] }));

  const pick = (next: Platform) => {
    setPlatform(next);
    onOpenChange(false);
    const current = reader.slug
      ? reader.manifest.pages.find(
          (p) => p.collection === reader.collection && p.slug === reader.slug,
        )
      : undefined;
    if (current?.platform && current.platform !== next) {
      const first = readingOrder(reader.manifest, reader.collection, next)[0];
      void navigate({
        to: "/$locale/$",
        params: {
          locale,
          _splat: first
            ? `${first.collection}/${first.slug}`
            : reader.collection,
        },
      });
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerTitle className="px-4 pt-2 pb-1 text-base">
          {t("platform.label")}
        </DrawerTitle>
        <DrawerDescription className="sr-only" />
        <ul className="px-2 pb-8">
          {options.map((option) => (
            <li key={option.key}>
              <button
                type="button"
                onClick={() => pick(option.key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left",
                  option.key === active ? "bg-muted font-medium" : "",
                )}
              >
                <Check
                  className={cn(
                    "size-4 shrink-0 text-primary",
                    option.key !== active && "invisible",
                  )}
                />
                {option.label}
                {option.underDevelopment && (
                  <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                    {t("platform.underDevelopment")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
