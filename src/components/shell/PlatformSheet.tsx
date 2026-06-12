import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { ClientInfo } from "@shared/content-schema";
import { usePlatformPicker } from "@/lib/usePlatformPicker";
import type { ReaderData } from "@/routes/$locale/$";
import { PlatformIcon, IncompleteBadge } from "@/components/shell/PlatformIcon";
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
  /** Present inside a book: enables client options + relocation on pick. */
  reader?: ReaderData;
}

/**
 * Mobile platform picker (bottom-bar item). Picking a platform while reading
 * a page that doesn't exist there continues at that platform's first page of
 * the current book — the selection always lands somewhere readable.
 */
export function PlatformSheet({
  open,
  onOpenChange,
  reader,
}: PlatformSheetProps) {
  const { t } = useTranslation();
  const { options, active, pick } = usePlatformPicker(reader);

  const choose = (option: ClientInfo) => {
    onOpenChange(false);
    pick(option);
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
            <li key={option.id}>
              <button
                type="button"
                onClick={() => choose(option)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left",
                  option.id === active?.id ? "bg-muted font-medium" : "",
                )}
              >
                <Check
                  className={cn(
                    "size-4 shrink-0 text-primary",
                    option.id !== active?.id && "invisible",
                  )}
                />
                <PlatformIcon
                  platform={option.platform}
                  className="size-4 shrink-0 text-muted-foreground"
                />
                {option.label}
                {option.underDevelopment && <IncompleteBadge />}
              </button>
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
