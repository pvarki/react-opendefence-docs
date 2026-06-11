import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Locale, SidebarConfig } from "@shared/content-schema";
import { loadSidebar } from "@/lib/content/loader";
import { usePlatform } from "@/lib/platform";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { SidebarItems } from "@/components/shell/SidebarNav";
import { filterSidebarByPlatform } from "@/lib/content/neighbors";

interface ContentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  contentLocale: Locale;
  collection: string;
  currentSlug?: string;
}

/**
 * Mobile book TOC bottom sheet (opened from the bottom bar's Contents
 * button), filtered to the active platform's chapters.
 */
export function ContentsSheet({
  open,
  onOpenChange,
  locale,
  contentLocale,
  collection,
  currentSlug,
}: ContentsSheetProps) {
  const { t } = useTranslation();
  const platform = usePlatform();
  const [sidebar, setSidebar] = useState<SidebarConfig>();

  useEffect(() => {
    let cancelled = false;
    loadSidebar(contentLocale, collection)
      .then((config) => {
        if (!cancelled) setSidebar(config);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [contentLocale, collection]);

  const items = sidebar ? filterSidebarByPlatform(sidebar.items, platform) : [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerTitle className="px-4 pt-2 pb-1 text-base">
          {sidebar?.label ?? t("nav.contents")}
        </DrawerTitle>
        <DrawerDescription className="sr-only" />
        <nav className="overflow-y-auto px-4 pb-8">
          <SidebarItems
            items={items}
            locale={locale}
            collection={collection}
            currentSlug={currentSlug}
            onNavigate={() => onOpenChange(false)}
          />
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
