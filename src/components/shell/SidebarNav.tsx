import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Braces,
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  Tag,
  type LucideIcon,
} from "lucide-react";
import type {
  Locale,
  LocaleManifest,
  ManifestCollection,
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
import { parentShelf } from "@/lib/siteSections";
import { stripBase } from "@/lib/base";
import { cn } from "@/lib/utils";
import { GuideIssuesLink } from "@/components/shell/GuideIssuesLink";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";

interface SidebarProps {
  locale: string;
  /** Locale whose sidebar JSON to load (en when falling back). */
  contentLocale: Locale;
  manifest: LocaleManifest;
  /** The open book, if any — the Develop shelf has none. */
  collection?: string;
  /** Forces the dev spine where no book identifies the section. */
  section?: "dev";
  currentSlug?: string;
  onNavigate?: () => void;
}

function isDevBook(manifest: LocaleManifest, collection?: string): boolean {
  return (
    manifest.collections.find((c) => c.slug === collection)?.section === "dev"
  );
}

function isDevSpine(props: SidebarProps): boolean {
  return props.section === "dev" || isDevBook(props.manifest, props.collection);
}

function sidebarSection(props: SidebarProps): ManifestCollection["section"] {
  if (isDevSpine(props)) return "dev";
  return (
    props.manifest.collections.find((c) => c.slug === props.collection)
      ?.section ?? "guides"
  );
}

function useSidebarTitle(props: SidebarProps): string {
  const { t } = useTranslation();
  if (isDevSpine(props)) return t("devNav.title");
  return (
    props.manifest.collections.find((c) => c.slug === props.collection)
      ?.label ??
    props.collection ??
    t("nav.contents")
  );
}

function useCurrentPath(): string {
  return useRouterState({
    select: (s) => stripBase(s.location.pathname).replace(/\/$/, ""),
  });
}

export function ShelfBackLink({
  onNavigate,
  className,
  ...props
}: SidebarProps & { className?: string }) {
  const { t } = useTranslation();
  const shelf = parentShelf(sidebarSection(props));
  return (
    <Link
      to={shelf.to}
      params={{ locale: props.locale }}
      onClick={onNavigate}
      className={cn(
        "-ml-1 inline-flex items-center gap-0.5 rounded-md py-0.5 pr-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <ChevronLeft className="size-3.5 shrink-0" />
      {t(shelf.labelKey)}
    </Link>
  );
}

export function SidebarNav(props: SidebarProps) {
  const title = useSidebarTitle(props);
  const isDev = isDevSpine(props);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <nav
        aria-label={title}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
      >
        <div className="px-2 pb-3">
          <ShelfBackLink {...props} />
          {isDev || !props.collection ? (
            <p className="mt-1 text-base leading-snug font-semibold text-foreground">
              {title}
            </p>
          ) : (
            <Link
              to="/$locale/$"
              params={{ locale: props.locale, _splat: props.collection }}
              onClick={props.onNavigate}
              className="mt-1 block text-base leading-snug font-semibold text-foreground transition-colors hover:text-primary"
            >
              {title}
            </Link>
          )}
        </div>
        <SidebarBody {...props} />
      </nav>
      <div className="shrink-0 border-t border-sidebar-border px-5 py-3">
        <GuideIssuesLink collection={props.collection} />
      </div>
    </aside>
  );
}

/** The tree itself, no aside chrome — desktop aside + mobile contents sheet. */
export function SidebarBody(props: SidebarProps) {
  return isDevSpine(props) ? <DevDocsNav {...props} /> : <BookNav {...props} />;
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
    if (!collection) return;
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

  if (!sidebar || !collection) return null;
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

// px-2 + chevron + gap, so leaf labels line up with chevron rows.
const CHEVRON_GUTTER = "pl-7";

const ACTIVE_ROW = "bg-primary/10 font-medium text-primary";

function Disclosure({ open }: { open: boolean }) {
  return (
    <ChevronRight
      aria-hidden
      className={cn(
        "size-3.5 shrink-0 text-muted-foreground/70 transition-transform",
        open && "rotate-90",
      )}
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
  variant = "rail",
  gutter,
}: {
  items: SidebarItem[];
  locale: string;
  collection: string;
  currentSlug?: string;
  onNavigate?: () => void;
  /** Open all groups initially (used by the book cover's full TOC). */
  defaultOpen?: boolean;
  /** "cover" marks pages with an icon so they read as links, not plain text. */
  variant?: "rail" | "cover";
  /** Indent leaf rows past the chevron column; by default when a sibling has one. */
  gutter?: boolean;
}) {
  const cover = variant === "cover";
  const indent =
    gutter ??
    items.some((item) => item.type === "group" || item.type === "toporg");
  const leafPad = indent ? CHEVRON_GUTTER : "pl-2";

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
            variant={variant}
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
            variant={variant}
          />
        ) : item.type === "doc" && item.slug ? (
          <li key={item.id}>
            <Link
              to="/$locale/$"
              params={{ locale, _splat: `${collection}/${item.slug}` }}
              onClick={onNavigate}
              className={cn(
                "rounded-md py-1.5 pr-2 text-sm transition-colors",
                cover
                  ? "group flex items-center gap-2 pl-2"
                  : `block ${leafPad}`,
                item.slug === currentSlug
                  ? ACTIVE_ROW
                  : cover
                    ? "text-foreground/90 hover:bg-muted hover:text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {cover && (
                <FileText className="size-3.5 shrink-0 text-primary/70 transition-colors group-hover:text-primary" />
              )}
              {item.label}
            </Link>
          </li>
        ) : item.type === "link" && item.href ? (
          <li key={item.id}>
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "block rounded-md py-1.5 pr-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                leafPad,
              )}
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

/** Top-level section from META: toporg in Outline. */
function SidebarToporg({
  item,
  locale,
  collection,
  currentSlug,
  onNavigate,
  defaultOpen = false,
  variant = "rail",
}: {
  item: SidebarItem;
  locale: string;
  collection: string;
  currentSlug?: string;
  onNavigate?: () => void;
  defaultOpen?: boolean;
  variant?: "rail" | "cover";
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
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-muted"
      >
        <Disclosure open={open} />
        <SectionLabel as="span" className="truncate">
          {item.label}
        </SectionLabel>
      </button>
      {open && item.children && (
        <SidebarItems
          items={item.children}
          locale={locale}
          collection={collection}
          currentSlug={currentSlug}
          onNavigate={onNavigate}
          defaultOpen={defaultOpen}
          variant={variant}
          gutter
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
  variant = "rail",
  href,
  extra,
  active,
  current,
}: {
  item: SidebarItem;
  locale: string;
  collection: string;
  currentSlug?: string;
  onNavigate?: () => void;
  defaultOpen?: boolean;
  variant?: "rail" | "cover";
  /** Splat to the group's own page; given, the label becomes a link. */
  href?: string;
  /** Rendered above the children (a book's API reference / changelog). */
  extra?: ReactNode;
  /** The reader is inside this group even when no child page is active. */
  active?: boolean;
  current?: boolean;
}) {
  const { t } = useTranslation();
  const inside = containsSlug(item.children, currentSlug) || !!active;
  const [open, setOpen] = useState(defaultOpen || inside);
  const expandable = !!extra || !!item.children?.length;

  // Reveal the group when navigation lands inside it (swipe, search, link) —
  // the render-time "adjust state on prop change" pattern.
  const [prevInside, setPrevInside] = useState(inside);
  if (inside !== prevInside) {
    setPrevInside(inside);
    if (inside) setOpen(true);
  }

  if (!href && !expandable) return null;

  const tone = current
    ? ACTIVE_ROW
    : inside
      ? "text-foreground hover:bg-muted"
      : "text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <li>
      {href ? (
        <div className="flex items-center">
          {expandable && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={t("sidebar.toggleGroup", { label: item.label })}
              className="ml-1 shrink-0 rounded-md p-1 hover:bg-muted"
            >
              <Disclosure open={open} />
            </button>
          )}
          <Link
            to="/$locale/$"
            params={{ locale, _splat: href }}
            onClick={onNavigate}
            aria-current={current ? "page" : undefined}
            className={cn(
              "min-w-0 flex-1 rounded-md py-1.5 pr-2 text-sm font-medium transition-colors",
              expandable ? "pl-0.5" : CHEVRON_GUTTER,
              tone,
            )}
          >
            {item.label}
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors",
            tone,
          )}
        >
          <Disclosure open={open} />
          {item.label}
        </button>
      )}
      {open && expandable && (
        <div className="mt-0.5 ml-3.5 border-l border-sidebar-border pl-2">
          {extra}
          {item.children && (
            <SidebarItems
              items={item.children}
              locale={locale}
              collection={collection}
              currentSlug={currentSlug}
              onNavigate={onNavigate}
              defaultOpen={defaultOpen}
              variant={variant}
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
  const link = (
    <Link
      to="/$locale/dev/$book/$view"
      params={{ locale, book: item.book, view: item.kind }}
      onClick={onNavigate}
      className={variant === "row" ? REF_ROW_CLASS : undefined}
    >
      <Icon className="size-4 shrink-0 text-primary" />
      {t(REF_LABEL_KEY[item.kind])}
    </Link>
  );

  return variant === "button" ? (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary"
    >
      {link}
    </Button>
  ) : (
    link
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
  const path = useCurrentPath();
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
          <SectionLabel as="p" className="px-2 pb-1">
            {t(section.labelKey)}
          </SectionLabel>
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
                  current={path === `/${locale}/${book.slug}`}
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
