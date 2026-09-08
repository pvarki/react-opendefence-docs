import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Braces,
  ChevronDown,
  FileText,
  History,
  Tag,
  type LucideIcon,
} from "lucide-react";
import type {
  Locale,
  LocaleManifest,
  SidebarConfig,
  SidebarItem,
} from "@shared/content-schema";
import { loadSidebar } from "@/lib/content/loader";
import {
  devNavSections,
  loadDevRefs,
  REF_LABEL_KEY,
  type DevRef,
  type DevRefsByBook,
} from "@/lib/devNav";
import {
  filterSidebarByClient,
  filterSidebarByPlatform,
  resolveClient,
} from "@/lib/content/neighbors";
import { useReadingView } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { GuideIssuesLink } from "@/components/shell/GuideIssuesLink";

export interface SidebarProps {
  locale: string;
  /** Locale whose sidebar JSON to load (en when falling back). */
  contentLocale: Locale;
  manifest: LocaleManifest;
  collection: string;
  currentSlug?: string;
  onNavigate?: () => void;
}

function isDevBook(manifest: LocaleManifest, collection: string): boolean {
  return (
    manifest.collections.find((c) => c.slug === collection)?.section === "dev"
  );
}

/**
 * Desktop book tree. A dev-section book gets the cross-book developer spine
 * instead of its own tree, so the reader can jump between books.
 */
export function SidebarNav(props: SidebarProps) {
  const { t } = useTranslation();
  const meta = props.manifest.collections.find(
    (c) => c.slug === props.collection,
  );
  const isDev = meta?.section === "dev";

  return (
    <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar md:block">
      <nav className="px-3 py-4">
        <p className="px-2 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {isDev ? t("devNav.title") : (meta?.label ?? props.collection)}
        </p>
        <GuideIssuesLink collection={props.collection} className="mb-2 px-2" />
        <SidebarBody {...props} />
      </nav>
    </aside>
  );
}

/** The tree itself, no aside chrome — desktop aside + mobile contents sheet. */
export function SidebarBody(props: SidebarProps) {
  return isDevBook(props.manifest, props.collection) ? (
    <DevDocsNav {...props} />
  ) : (
    <BookNav {...props} />
  );
}

function BookNav({
  locale,
  contentLocale,
  manifest,
  collection,
  currentSlug,
  onNavigate,
}: SidebarProps) {
  const view = useReadingView();
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

  if (!sidebar) return null;
  const client = resolveClient(manifest, collection, view);

  return (
    <SidebarItems
      items={filterSidebarByPlatform(
        filterSidebarByClient(sidebar.items, client?.id),
        view.platform,
      )}
      locale={locale}
      collection={collection}
      currentSlug={currentSlug}
      onNavigate={onNavigate}
    />
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
  href,
  extra,
  active,
}: {
  item: SidebarItem;
  locale: string;
  collection: string;
  currentSlug?: string;
  onNavigate?: () => void;
  defaultOpen?: boolean;
  /** Splat to the group's own page; given, the label becomes a link. */
  href?: string;
  /** Rendered above the children (a book's API reference / changelog). */
  extra?: ReactNode;
  /** The reader is inside this group even when no child page is active. */
  active?: boolean;
}) {
  const inside = containsSlug(item.children, currentSlug) || !!active;
  const [open, setOpen] = useState(defaultOpen || inside);

  // Reveal the group when navigation lands inside it (swipe, search, link) —
  // the render-time "adjust state on prop change" pattern.
  const [prevInside, setPrevInside] = useState(inside);
  if (inside !== prevInside) {
    setPrevInside(inside);
    if (inside) setOpen(true);
  }

  const chevron = (
    <ChevronDown
      className={cn(
        "size-4 shrink-0 text-muted-foreground transition-transform",
        !open && "-rotate-90",
      )}
    />
  );

  return (
    <li>
      {href ? (
        <div className="flex items-center">
          <Link
            to="/$locale/$"
            params={{ locale, _splat: href }}
            onClick={onNavigate}
            className={cn(
              "min-w-0 flex-1 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted hover:text-foreground",
              inside ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {item.label}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={item.label}
            className="rounded-md p-1 hover:bg-muted"
          >
            {chevron}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-1 rounded-md px-2 py-1.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {item.label}
          {chevron}
        </button>
      )}
      {open && (!!extra || !!item.children?.length) && (
        <div className="mt-0.5 ml-2 border-l border-sidebar-border pl-2">
          {extra}
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
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Cross-book developer-docs nav: the whole dev spine, so the reader can jump
// across books and back to the Develop shelf.
// ---------------------------------------------------------------------------

const NO_REFS: DevRefsByBook = new Map();

const REF_ICON: Record<DevRef["kind"], LucideIcon> = {
  api: Braces,
  releases: Tag,
  notes: FileText,
  changelog: History,
};

const REF_ROW_CLASS =
  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground";

const REF_BUTTON_CLASS =
  "inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary";

function DevRefLink({
  locale,
  item,
  variant,
  onNavigate,
}: {
  locale: string;
  item: DevRef;
  variant: "row" | "button";
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const Icon = REF_ICON[item.kind];
  const className = variant === "button" ? REF_BUTTON_CLASS : REF_ROW_CLASS;
  const body = (
    <>
      <Icon className="size-4 shrink-0 text-primary" />
      {t(REF_LABEL_KEY[item.kind])}
    </>
  );

  return (
    <Link
      to="/$locale/dev/$book/$view"
      params={{ locale, book: item.book, view: item.kind }}
      onClick={onNavigate}
      className={className}
    >
      {body}
    </Link>
  );
}

/** A book's reference material: rows in the sidebar, buttons on the cover. */
export function DevRefList({
  locale,
  refs,
  divider,
  variant = "row",
  onNavigate,
}: {
  locale: string;
  refs: DevRef[];
  divider?: boolean;
  variant?: "row" | "button";
  onNavigate?: () => void;
}) {
  if (refs.length === 0) return null;

  if (variant === "button") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {refs.map((ref) => (
          <DevRefLink
            key={ref.kind}
            locale={locale}
            item={ref}
            variant="button"
            onNavigate={onNavigate}
          />
        ))}
      </div>
    );
  }

  return (
    <ul
      className={cn(
        "space-y-0.5",
        divider && "mb-1 border-b border-border pb-1",
      )}
    >
      {refs.map((ref) => (
        <li key={ref.kind}>
          <DevRefLink
            locale={locale}
            item={ref}
            variant="row"
            onNavigate={onNavigate}
          />
        </li>
      ))}
    </ul>
  );
}

function DevDocsNav({
  locale,
  contentLocale,
  manifest,
  collection,
  currentSlug,
  onNavigate,
}: SidebarProps) {
  const { t } = useTranslation();
  const view = useReadingView();
  const [sidebars, setSidebars] = useState<Record<string, SidebarConfig>>({});
  const [refs, setRefs] = useState<DevRefsByBook>(NO_REFS);

  useEffect(() => {
    let cancelled = false;
    const slugs = manifest.collections
      .filter((c) => c.section === "dev")
      .map((c) => c.slug);
    void Promise.all(
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

  useEffect(() => {
    let cancelled = false;
    void loadDevRefs().then((loaded) => {
      if (!cancelled) setRefs(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {devNavSections(manifest, refs).map((section) => (
        <div key={section.key} className="pt-3">
          <p className="px-2 pb-1 text-[11px] font-semibold tracking-widest text-primary uppercase">
            {t(section.labelKey)}
          </p>
          <ul className="space-y-0.5">
            {section.books.map(({ book, refs: bookRefs }) => {
              const sidebar = sidebars[book.slug];
              const client = resolveClient(manifest, book.slug, view);
              const items = sidebar
                ? filterSidebarByPlatform(
                    filterSidebarByClient(sidebar.items, client?.id),
                    view.platform,
                  )
                : [];
              return (
                <SidebarGroup
                  key={book.slug}
                  item={{
                    type: "group",
                    id: book.slug,
                    label: book.label,
                    children: items,
                  }}
                  locale={locale}
                  collection={book.slug}
                  currentSlug={currentSlug}
                  href={book.slug}
                  active={book.slug === collection}
                  extra={
                    <DevRefList
                      locale={locale}
                      refs={bookRefs}
                      divider={items.length > 0}
                      onNavigate={onNavigate}
                    />
                  }
                  onNavigate={onNavigate}
                />
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
