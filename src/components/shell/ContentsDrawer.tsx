import { useTranslation } from "react-i18next";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { SidebarBody } from "@/components/shell/SidebarNav";
import { usePlatformPicker } from "@/lib/usePlatformPicker";
import { PlatformList } from "@/components/shell/PlatformList";
import { GuideIssuesLink } from "@/components/shell/GuideIssuesLink";
import type { ReaderData } from "@/routes/$locale/$";

interface ContentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  reader: ReaderData;
}

/**
 * Mobile book TOC bottom sheet (opened from the bottom bar's Contents
 * button). Books with selectable clients (e.g. the TAK guide) lead with an
 * "Available platforms" switcher; below it is the same tree the desktop
 * sidebar renders.
 */
export function ContentsSheet({
  open,
  onOpenChange,
  locale,
  reader,
}: ContentsSheetProps) {
  const { t } = useTranslation();
  const { options, active, pick, hasClients } = usePlatformPicker(reader);
  const collection = reader.manifest.collections.find(
    (c) => c.slug === reader.collection,
  );
  const isDev = collection?.section === "dev";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <div className="flex items-center justify-between gap-3 px-4 pt-2 pb-1">
          <DrawerTitle className="text-base">
            {isDev
              ? t("devNav.title")
              : (collection?.label ?? t("nav.contents"))}
          </DrawerTitle>
          <GuideIssuesLink collection={reader.collection} />
        </div>
        <DrawerDescription className="sr-only" />
        <nav className="overflow-y-auto px-4 pb-8">
          {hasClients && (
            <>
              <p className="px-1 pt-3 pb-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                {t("platform.available")}
              </p>
              <PlatformList
                options={options}
                activeId={active?.id}
                onPick={(option) => {
                  onOpenChange(false);
                  pick(option);
                }}
              />
            </>
          )}
          <SidebarBody
            locale={locale}
            contentLocale={reader.contentLocale}
            manifest={reader.manifest}
            collection={reader.collection}
            currentSlug={reader.slug}
            onNavigate={() => onOpenChange(false)}
          />
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
