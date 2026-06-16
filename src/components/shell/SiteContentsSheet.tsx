import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Braces, Tag } from "lucide-react";
import type { Locale, LocaleManifest } from "@shared/content-schema";
import { loadManifest } from "@/lib/content/loader";
import { siteSections } from "@/lib/siteSections";
import { stripBase } from "@/lib/base";
import { useShelfContext } from "@/lib/useShelfContext";
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

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerTitle className="px-4 pt-2 pb-1 text-base">{title}</DrawerTitle>
        <DrawerDescription className="sr-only" />
        <nav className="overflow-y-auto px-4 pb-8">
          {manifest &&
            siteSections(manifest)
              .filter((section) => isHome || section.shelf === shelf.key)
              .map((section) => (
                <div key={section.titleKey}>
                  <p className="px-1 pt-4 pb-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                    {t(section.titleKey)}
                  </p>
                  <ul className="space-y-0.5">
                    {section.books.map((book) => (
                      <li key={book.slug}>
                        <Link
                          to="/$locale/$"
                          params={{ locale, _splat: book.slug }}
                          onClick={() => onOpenChange(false)}
                          className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {book.label}
                        </Link>
                      </li>
                    ))}
                    {section.withApiReference && (
                      <li>
                        <Link
                          to="/$locale/dev/api"
                          params={{ locale }}
                          onClick={() => onOpenChange(false)}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Braces className="size-3.5" />
                          {t("apiRef.title")}
                        </Link>
                      </li>
                    )}
                    {section.withReleases && (
                      <li>
                        <Link
                          to="/$locale/dev/releases"
                          params={{ locale }}
                          onClick={() => onOpenChange(false)}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Tag className="size-3.5" />
                          {t("releases.title")}
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              ))}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
