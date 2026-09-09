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
import type { BookContext } from "@/lib/bookContext";

interface ContentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  book: BookContext;
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
  book,
}: ContentsSheetProps) {
  const { t } = useTranslation();
  const { options, active, pick, hasClients } = usePlatformPicker(book);
  const collection = book.manifest.collections.find(
    (c) => c.slug === book.collection,
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
          <GuideIssuesLink collection={book.collection} />
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
            contentLocale={book.contentLocale}
            manifest={book.manifest}
            collection={book.collection}
            currentSlug={book.slug}
            onNavigate={() => onOpenChange(false)}
          />
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
