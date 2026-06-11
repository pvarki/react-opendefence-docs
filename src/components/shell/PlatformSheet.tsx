import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { PLATFORMS, type ClientInfo } from "@shared/content-schema";
import {
  PLATFORM_LABELS,
  setClientForBook,
  setPlatform,
  useReadingView,
} from "@/lib/platform";
import { readingOrder, resolveClient } from "@/lib/content/neighbors";
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
  const view = useReadingView();
  const navigate = useNavigate();

  const bookClients = reader.manifest.collections.find(
    (c) => c.slug === reader.collection,
  )?.clients;
  // Books without clients still offer the generic platform choice (it
  // drives the rest of the app).
  const options: ClientInfo[] =
    bookClients && bookClients.length > 0
      ? bookClients
      : PLATFORMS.map((key) => ({
          id: key,
          platform: key,
          label: PLATFORM_LABELS[key],
        }));

  const active = bookClients?.length
    ? resolveClient(reader.manifest, reader.collection, view)
    : options.find((o) => o.platform === view.platform);

  const pick = (next: ClientInfo) => {
    if (bookClients?.length) setClientForBook(reader.collection, next.id);
    setPlatform(next.platform);
    onOpenChange(false);
    const current = reader.slug
      ? reader.manifest.pages.find(
          (p) => p.collection === reader.collection && p.slug === reader.slug,
        )
      : undefined;
    // Reading a page that doesn't exist in the picked view: continue at the
    // view's first page of this book.
    if (current && (current.clientId ?? current.platform)) {
      const stillVisible = current.clientId
        ? current.clientId === next.id
        : current.platform === next.platform;
      if (!stillVisible) {
        const nextView = {
          platform: next.platform,
          clientOverrides: {
            ...view.clientOverrides,
            [reader.collection]: next.id,
          },
        };
        const first = readingOrder(
          reader.manifest,
          reader.collection,
          nextView,
        )[0];
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
            <li key={option.id}>
              <button
                type="button"
                onClick={() => pick(option)}
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
