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
import { devBookGroups } from "@/lib/devGroups";
import {
  filterSidebarByClient,
  filterSidebarByPlatform,
} from "@/lib/content/neighbors";
import { usePlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { GuideIssuesLink } from "@/components/shell/GuideIssuesLink";

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
  const platform = usePlatform();

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
        <p className="px-2 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {sidebar.label}
        </p>
        <GuideIssuesLink collection={collection} className="mb-2 px-2" />
        <SidebarItems
          items={filterSidebarByPlatform(
            filterSidebarByClient(sidebar.items, clientId),
            platform,
          )}
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
          <SidebarToporg
            key={item.id}
            item={item}
            locale={locale}
            collection={collection}
            currentSlug={currentSlug}
            onNavigate={onNavigate}
            defaultOpen={defaultOpen}
          />
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
                  ? "bg-muted font-medium text-foreground"
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

/** Does the current page live anywhere in this subtree (toporg > group > doc)? */
function containsSlug(
  items: SidebarItem[] | undefined,
  slug?: string,
): boolean {
  if (!items || !slug) return false;
  return items.some((c) => c.slug === slug || containsSlug(c.children, slug));
}

/**
 * A toporg is a top-level section grouping chapters (META: toporg in Outline).
 * Collapsible and orange (primary) to stand apart from chapters/the active
 * page. Open by default only when it holds chapters directly — sections that
 * are purely sub-folder containers (e.g. "Additional Features") start collapsed
 * to keep the tree scannable. The section holding the current page always opens.
 */
function SidebarToporg({
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
  const hasDirectChapter = !!item.children?.some(
    (c) => c.type === "doc" || c.type === "link",
  );
  const containsCurrent = containsSlug(item.children, currentSlug);
  const [open, setOpen] = useState(
    defaultOpen || containsCurrent || hasDirectChapter,
  );

  // Reveal the section when navigation lands inside it (swipe, search, link).
  const [prevContains, setPrevContains] = useState(containsCurrent);
  if (containsCurrent !== prevContains) {
    setPrevContains(containsCurrent);
    if (containsCurrent) setOpen(true);
  }

  return (
    <li className="pt-3 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold tracking-widest text-primary uppercase hover:bg-muted"
      >
        <span className="truncate">{item.label}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>
      {open && item.children && (
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
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
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
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-semibold tracking-widest text-primary uppercase hover:bg-muted"
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

  const groups = devBookGroups(devBooks);
  const renderBook = (book: (typeof devBooks)[number]) => (
    <DevBookGroup
      key={book.slug}
      book={book}
      sidebar={sidebars[book.slug]}
      locale={locale}
      isCurrent={book.slug === currentCollection}
      currentSlug={book.slug === currentCollection ? currentSlug : undefined}
      clientId={book.slug === currentCollection ? clientId : undefined}
      onNavigate={onNavigate}
    />
  );

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
      <p className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        Deploy App
      </p>
      {groups.deployApp.map(renderBook)}
      {groups.integrations.length > 0 && (
        <>
          <p className="mt-3 border-t border-sidebar-border px-2 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Official integrations
          </p>
          {groups.integrations.map(renderBook)}
        </>
      )}
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
