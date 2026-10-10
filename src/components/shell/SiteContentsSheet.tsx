import { Fragment, useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  BookText,
  Code2,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import type {
  Locale,
  LocaleManifest,
  ManifestCollection,
} from "@shared/content-schema";
import { loadManifest } from "@/lib/content/loader";
import { devNavSections } from "@/lib/devNav";
import { siteSections } from "@/lib/siteSections";
import { stripBase } from "@/lib/base";
import { useShelfContext } from "@/lib/useShelfContext";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/ui/section-label";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";

interface SiteContentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
}

/**
 * The Contents button outside a reader, context-aware: the whole site from
 * Home ("Contents of the site"), only the current shelf elsewhere — e.g.
 * "Available guides" listing what the Guides page lists.
 */
export function SiteContentsSheet({
  open,
  onOpenChange,
  locale,
}: SiteContentsSheetProps) {
  const { t } = useTranslation();
  const [manifest, setManifest] = useState<LocaleManifest>();
  const pathname = useRouterState({
    select: (s) => stripBase(s.location.pathname),
  });
  const shelf = useShelfContext();
  const isHome = pathname.replace(/\/$/, "") === `/${locale}`;

  useEffect(() => {
    let cancelled = false;
    loadManifest(locale)
      .then((m) => {
        if (!cancelled) setManifest(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const title = isHome
    ? t("contents.siteTitle")
    : shelf.key === "guides"
      ? t("contents.guidesTitle")
      : t(shelf.labelKey);
  const close = () => onOpenChange(false);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerTitle className="px-4 pt-2 pb-1 text-base">{title}</DrawerTitle>
        <DrawerDescription className="sr-only" />
        <nav className="overflow-y-auto px-3 pb-6">
          {manifest &&
            siteSections(manifest)
              .filter((section) => isHome || section.shelf === shelf.key)
              .map((section) => {
                const heading = t(section.titleKey);
                const Icon = SECTION_ICONS[section.titleKey] ?? BookOpen;
                const groups =
                  section.shelf === "developer"
                    ? devNavSections(manifest).map((s) => ({
                        label: t(s.labelKey),
                        books: s.books.map((b) => b.book),
                      }))
                    : [{ label: undefined, books: section.books }];
                const solo =
                  section.books.length === 1 &&
                  section.books[0].label === heading;
                return (
                  <section key={section.titleKey} className="pt-3">
                    {!solo && (
                      <SectionLabel as="h3" className="px-2 pb-1">
                        {heading}
                      </SectionLabel>
                    )}
                    {groups.map((group) =>
                      group.books.length === 0 ? null : (
                        <Fragment key={group.label ?? "all"}>
                          {group.label && (
                            <p className="px-2 pt-2 pb-0.5 text-xs font-medium text-muted-foreground/80">
                              {group.label}
                            </p>
                          )}
                          <ul>
                            {group.books.map((book) => (
                              <li key={book.slug}>
                                <BookRow
                                  locale={locale}
                                  book={book}
                                  icon={Icon}
                                  current={`${pathname}/`.startsWith(
                                    `/${locale}/${book.slug}/`,
                                  )}
                                  onNavigate={close}
                                />
                              </li>
                            ))}
                          </ul>
                        </Fragment>
                      ),
                    )}
                  </section>
                );
              })}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}

const SECTION_ICONS: Record<string, LucideIcon> = {
  "nav.deployApp": Smartphone,
  "sections.products": BookOpen,
  "nav.advanced": BookText,
  "sections.developer": Code2,
};

function BookRow({
  locale,
  book,
  icon: Icon,
  current,
  onNavigate,
}: {
  locale: Locale;
  book: ManifestCollection;
  icon: LucideIcon;
  current: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      to="/$locale/$"
      params={{ locale, _splat: book.slug }}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted",
        current && "bg-primary/10",
      )}
    >
      <Icon
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0">
        <span
          className={cn(
            "block text-sm font-medium",
            current ? "text-primary" : "text-foreground",
          )}
        >
          {book.label}
        </span>
        {book.description && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
            {book.description}
          </span>
        )}
      </span>
    </Link>
  );
}
