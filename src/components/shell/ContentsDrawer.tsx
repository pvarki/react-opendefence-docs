import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SidebarConfig } from "@shared/content-schema";
import { loadSidebar } from "@/lib/content/loader";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DevDocsNavBody, SidebarItems } from "@/components/shell/SidebarNav";
import { filterSidebarByClient } from "@/lib/content/neighbors";
import { usePlatformPicker } from "@/lib/usePlatformPicker";
import { PlatformList } from "@/components/shell/PlatformList";
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
 * "Available platforms" switcher; the chapter tree below is filtered to the
 * active platform. Wikis and dev books have no clients, so they show the
 * whole TOC.
 */
export function ContentsSheet({
  open,
  onOpenChange,
  locale,
  reader,
}: ContentsSheetProps) {
  const { t } = useTranslation();
  const [sidebar, setSidebar] = useState<SidebarConfig>();
  const { options, active, pick, hasClients } = usePlatformPicker(reader);

  useEffect(() => {
    let cancelled = false;
    loadSidebar(reader.contentLocale, reader.collection)
      .then((config) => {
        if (!cancelled) setSidebar(config);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reader.contentLocale, reader.collection]);

  const items = sidebar
    ? filterSidebarByClient(sidebar.items, hasClients ? active?.id : undefined)
    : [];
  const isDev =
    reader.manifest.collections.find((c) => c.slug === reader.collection)
      ?.section === "dev";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerTitle className="px-4 pt-2 pb-1 text-base">
          {sidebar?.label ?? t("nav.contents")}
        </DrawerTitle>
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
          {isDev ? (
            <DevDocsNavBody
              locale={locale}
              contentLocale={reader.contentLocale}
              manifest={reader.manifest}
              currentCollection={reader.collection}
              currentSlug={reader.slug}
              clientId={hasClients ? active?.id : undefined}
              onNavigate={() => onOpenChange(false)}
            />
          ) : (
            <SidebarItems
              items={items}
              locale={locale}
              collection={reader.collection}
              currentSlug={reader.slug}
              onNavigate={() => onOpenChange(false)}
            />
          )}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
