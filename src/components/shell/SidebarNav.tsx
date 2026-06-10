import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import type {
  Locale,
  SidebarConfig,
  SidebarItem,
} from "@shared/content-schema";
import { loadSidebar } from "@/lib/content/loader";
import { cn } from "@/lib/utils";

interface SidebarNavProps {
  locale: string;
  /** Locale whose sidebar JSON to load (en when falling back). */
  contentLocale: Locale;
  collection: string;
  currentSlug?: string;
}

/**
 * Desktop book tree (current collection only — the shelf tabs switch books).
 * Groups collapse, but nesting never exceeds group > page by construction:
 * the sync pipeline flattens deeper Outline trees.
 */
export function SidebarNav({
  locale,
  contentLocale,
  collection,
  currentSlug,
}: SidebarNavProps) {
  const [sidebar, setSidebar] = useState<SidebarConfig>();

  useEffect(() => {
    let cancelled = false;
    loadSidebar(contentLocale, collection)
      .then((config) => {
        if (!cancelled) setSidebar(config);
      })
      .catch(() => {
        // Book TOC unavailable — reader still works via swipe/prev-next.
      });
    return () => {
      cancelled = true;
    };
  }, [contentLocale, collection]);

  if (!sidebar)
    return (
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:block" />
    );

  return (
    <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar md:block">
      <nav className="px-3 py-4">
        <p className="px-2 pb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {sidebar.label}
        </p>
        <SidebarItems
          items={sidebar.items}
          locale={locale}
          collection={collection}
          currentSlug={currentSlug}
        />
      </nav>
    </aside>
  );
}

export function SidebarItems({
  items,
  locale,
  collection,
  currentSlug,
  onNavigate,
}: {
  items: SidebarItem[];
  locale: string;
  collection: string;
  currentSlug?: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) =>
        item.type === "group" ? (
          <SidebarGroup
            key={item.id}
            item={item}
            locale={locale}
            collection={collection}
            currentSlug={currentSlug}
            onNavigate={onNavigate}
          />
        ) : item.type === "doc" && item.slug ? (
          <li key={item.id}>
            <Link
              to="/$locale/$"
              params={{ locale, _splat: `${collection}/${item.slug}` }}
              onClick={onNavigate}
              className={cn(
                "block rounded-md px-2 py-1.5 text-sm transition-colors",
                item.slug === currentSlug
                  ? "bg-muted font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          </li>
        ) : item.type === "link" && item.href ? (
          <li key={item.id}>
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </a>
          </li>
        ) : null,
      )}
    </ul>
  );
}

function SidebarGroup({
  item,
  locale,
  collection,
  currentSlug,
  onNavigate,
}: {
  item: SidebarItem;
  locale: string;
  collection: string;
  currentSlug?: string;
  onNavigate?: () => void;
}) {
  const containsCurrent = !!item.children?.some((c) => c.slug === currentSlug);
  const [open, setOpen] = useState(containsCurrent);

  // Reveal the group when navigation lands inside it (swipe, search, link) —
  // the render-time "adjust state on prop change" pattern.
  const [prevContains, setPrevContains] = useState(containsCurrent);
  if (containsCurrent !== prevContains) {
    setPrevContains(containsCurrent);
    if (containsCurrent) setOpen(true);
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
      >
        {item.label}
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>
      {open && item.children && (
        <div className="mt-0.5 ml-2 border-l border-sidebar-border pl-2">
          <SidebarItems
            items={item.children}
            locale={locale}
            collection={collection}
            currentSlug={currentSlug}
            onNavigate={onNavigate}
          />
        </div>
      )}
    </li>
  );
}
