import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft } from "lucide-react";
import type {
  Locale,
  LocaleManifest,
  ManifestCollection,
  SidebarConfig,
  SidebarItem,
} from "@shared/content-schema";
import { loadSidebar } from "@/lib/content/loader";
import { filterSidebarByClient } from "@/lib/content/neighbors";
import { cn } from "@/lib/utils";

interface SidebarNavProps {
  locale: string;
  /** Locale whose sidebar JSON to load (en when falling back). */
  contentLocale: Locale;
  collection: string;
  currentSlug?: string;
  /** Active client id for this book (filters client-tagged sections). */
  clientId?: string;
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
  clientId,
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
          items={filterSidebarByClient(sidebar.items, clientId)}
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
  defaultOpen = false,
}: {
  items: SidebarItem[];
  locale: string;
  collection: string;
  currentSlug?: string;
  onNavigate?: () => void;
  /** Open all groups initially (used by the book cover's full TOC). */
  defaultOpen?: boolean;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) =>
        item.type === "toporg" ? (
          // A toporg is a section heading grouping chapters — always open,
          // never a link (META: toporg in Outline).
          <li key={item.id} className="pt-3 first:pt-0">
            <p className="px-2 pb-1 text-[11px] font-semibold tracking-widest text-foreground uppercase">
              {item.label}
            </p>
            {item.children && (
              <SidebarItems
                items={item.children}
                locale={locale}
                collection={collection}
                currentSlug={currentSlug}
                onNavigate={onNavigate}
                defaultOpen={defaultOpen}
              />
            )}
          </li>
        ) : item.type === "group" ? (
          <SidebarGroup
            key={item.id}
            item={item}
            locale={locale}
            collection={collection}
            currentSlug={currentSlug}
            onNavigate={onNavigate}
            defaultOpen={defaultOpen}
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
  defaultOpen = false,
}: {
  item: SidebarItem;
  locale: string;
  collection: string;
  currentSlug?: string;
  onNavigate?: () => void;
  defaultOpen?: boolean;
}) {
  const containsCurrent = !!item.children?.some((c) => c.slug === currentSlug);
  const [open, setOpen] = useState(defaultOpen || containsCurrent);

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
            defaultOpen={defaultOpen}
          />
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Cross-book developer-docs nav: inside any "dev" section book, show the whole
// developer-docs tree (every dev book collapsible, current one expanded) so the
// reader can jump across books and back to the Develop shelf.
// ---------------------------------------------------------------------------

interface DevDocsNavProps {
  locale: string;
  contentLocale: Locale;
  manifest: LocaleManifest;
  currentCollection: string;
  currentSlug?: string;
  /** Active client id for the CURRENT book (filters its platform sections). */
  clientId?: string;
  onNavigate?: () => void;
}

function DevBookGroup({
  book,
  sidebar,
  locale,
  isCurrent,
  currentSlug,
  clientId,
  onNavigate,
}: {
  book: ManifestCollection;
  sidebar?: SidebarConfig;
  locale: string;
  isCurrent: boolean;
  currentSlug?: string;
  clientId?: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(isCurrent);
  const items = sidebar ? filterSidebarByClient(sidebar.items, clientId) : [];
  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-semibold tracking-widest uppercase",
          isCurrent
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="truncate">{book.label}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            open ? "" : "-rotate-90",
          )}
        />
      </button>
      {open && items.length > 0 && (
        <SidebarItems
          items={items}
          locale={locale}
          collection={book.slug}
          currentSlug={currentSlug}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

/** The cross-book dev nav body (no chrome) — used by desktop + mobile. */
export function DevDocsNavBody({
  locale,
  contentLocale,
  manifest,
  currentCollection,
  currentSlug,
  clientId,
  onNavigate,
}: DevDocsNavProps) {
  const devBooks = manifest.collections
    .filter((c) => c.section === "dev")
    .slice()
    .sort((a, b) => a.order - b.order);
  const [sidebars, setSidebars] = useState<Record<string, SidebarConfig>>({});

  useEffect(() => {
    let cancelled = false;
    const slugs = manifest.collections
      .filter((c) => c.section === "dev")
      .map((c) => c.slug);
    Promise.all(
      slugs.map((slug) =>
        loadSidebar(contentLocale, slug).then(
          (sb) => [slug, sb] as const,
          () => [slug, undefined] as const,
        ),
      ),
    ).then((entries) => {
      if (cancelled) return;
      const map: Record<string, SidebarConfig> = {};
      for (const [slug, sb] of entries) if (sb) map[slug] = sb;
      setSidebars(map);
    });
    return () => {
      cancelled = true;
    };
  }, [contentLocale, manifest]);

  return (
    <div>
      <Link
        to="/$locale/dev"
        params={{ locale }}
        onClick={onNavigate}
        className="mb-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5 shrink-0" />
        All developer docs
      </Link>
      {devBooks.map((book) => (
        <DevBookGroup
          key={book.slug}
          book={book}
          sidebar={sidebars[book.slug]}
          locale={locale}
          isCurrent={book.slug === currentCollection}
          currentSlug={
            book.slug === currentCollection ? currentSlug : undefined
          }
          clientId={book.slug === currentCollection ? clientId : undefined}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

/** Desktop aside variant of the cross-book dev nav. */
export function DevDocsSidebar(props: DevDocsNavProps) {
  return (
    <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar md:block">
      <nav className="px-3 py-4">
        <p className="px-2 pb-2 text-xs font-semibold tracking-wider text-foreground uppercase">
          Developer docs
        </p>
        <DevDocsNavBody {...props} />
      </nav>
    </aside>
  );
}
