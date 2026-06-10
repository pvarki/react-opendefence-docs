import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TableOfContents } from "lucide-react";
import type { Locale, SidebarConfig } from "@shared/content-schema";
import { loadSidebar } from "@/lib/content/loader";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { SidebarItems } from "@/components/shell/SidebarNav";

interface ContentsDrawerProps {
  locale: string;
  contentLocale: Locale;
  collection: string;
  currentSlug?: string;
}

/** Mobile book TOC: a bottom sheet, like flipping to a book's contents page. */
export function ContentsDrawer({
  locale,
  contentLocale,
  collection,
  currentSlug,
}: ContentsDrawerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
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

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <TableOfContents />
          {t("nav.contents")}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerTitle className="px-4 pt-2 pb-1 text-base">
          {sidebar?.label ?? t("nav.contents")}
        </DrawerTitle>
        <DrawerDescription className="sr-only" />
        <nav className="overflow-y-auto px-4 pb-8">
          {sidebar && (
            <SidebarItems
              items={sidebar.items}
              locale={locale}
              collection={collection}
              currentSlug={currentSlug}
              onNavigate={() => setOpen(false)}
            />
          )}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
