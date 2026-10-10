import { useTranslation } from "react-i18next";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ShelfBackLink, SidebarBody } from "@/components/shell/SidebarNav";
import { usePlatformPicker } from "@/lib/usePlatformPicker";
import { PlatformList } from "@/components/shell/PlatformList";
import { GuideIssuesLink } from "@/components/shell/GuideIssuesLink";
import { SectionLabel } from "@/components/ui/section-label";
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
  const close = () => onOpenChange(false);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <div className="px-4 pt-2 pb-1">
          <ShelfBackLink
            locale={locale}
            contentLocale={book.contentLocale}
            manifest={book.manifest}
            collection={book.collection}
            onNavigate={close}
          />
          <DrawerTitle className="mt-0.5 text-base">
            {isDev
              ? t("devNav.title")
              : (collection?.label ?? t("nav.contents"))}
          </DrawerTitle>
        </div>
        <DrawerDescription className="sr-only" />
        <nav className="overflow-y-auto px-4 pb-6">
          {hasClients && (
            <div className="pt-2">
              <SectionLabel as="p" className="px-1 pb-2">
                {t("platform.available")}
              </SectionLabel>
              <PlatformList
                variant="chips"
                options={options}
                activeId={active?.id}
                onPick={(option) => {
                  close();
                  pick(option);
                }}
              />
              <SectionLabel as="p" className="px-1 pt-5 pb-1.5">
                {t("nav.contents")}
              </SectionLabel>
            </div>
          )}
          <SidebarBody
            locale={locale}
            contentLocale={book.contentLocale}
            manifest={book.manifest}
            collection={book.collection}
            currentSlug={book.slug}
            onNavigate={close}
          />
          <div className="mt-4 border-t border-border px-1 pt-3">
            <GuideIssuesLink collection={book.collection} />
          </div>
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
