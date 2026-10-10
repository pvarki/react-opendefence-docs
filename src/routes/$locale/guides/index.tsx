import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  BookText,
  ChevronDown,
  Code2,
  Smartphone,
} from "lucide-react";
import type { ManifestCollection } from "@shared/content-schema";
import { BookCard } from "@/components/shell/BookCard";
import { ShelfHero } from "@/components/shell/ShelfHero";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SectionLabel } from "@/components/ui/section-label";
import { CARD_IMAGES } from "@/lib/cardImages";
import { loadManifest } from "@/lib/content/loader";
import { PAGE_FRAME } from "@/lib/pageFrame";
import { siteSections } from "@/lib/siteSections";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$locale/guides/")({
  loader: async ({ context }) => {
    const manifest = await loadManifest(context.locale);
    return {
      sections: siteSections(manifest).filter((s) => s.shelf === "guides"),
    };
  },
  component: GuidesShelf,
});

const SECTION_ICONS = {
  "nav.deployApp": Smartphone,
  "sections.products": BookOpen,
  "nav.advanced": BookText,
  "sections.developer": Code2,
} as const;

function bookIcon(titleKey: string) {
  return SECTION_ICONS[titleKey as keyof typeof SECTION_ICONS] ?? BookOpen;
}

/**
 * The guides shelf: Deploy App and the product guides under toporg-style
 * headings. Advanced (wikis) and Developer content have their own shelves,
 * reached from Home and the context-aware bottom bar.
 */
function GuidesShelf() {
  const { t } = useTranslation();
  const { locale } = Route.useParams();
  const { sections } = Route.useLoaderData();

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <ShelfHero title={t("nav.guides")} />
      <div className={cn(PAGE_FRAME, "pt-2 pb-8 md:pb-10")}>
        {sections.map((section) => (
          <Fragment key={section.titleKey}>
            <SectionLabel className="px-1 pt-6 pb-2">
              {t(section.titleKey)}
            </SectionLabel>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:gap-3 lg:grid-cols-3">
              {section.books.map((book: ManifestCollection) => (
                <BookCard
                  key={book.slug}
                  locale={locale}
                  to="/$locale/$"
                  splat={book.slug}
                  icon={bookIcon(section.titleKey)}
                  title={book.label}
                  description={book.description}
                  image={CARD_IMAGES[book.slug]}
                />
              ))}
            </div>
          </Fragment>
        ))}
        <GuidesAbout />
      </div>
      <SiteFooter agentExample={t("agentNote.exampleGuides")} />
    </div>
  );
}

/** Product integrations covered by the guides; body text lives in i18n. */
const PRODUCTS = [
  { name: "TAK", bodyKey: "guidesFooter.products.tak" },
  { name: "Matrix", bodyKey: "guidesFooter.products.matrix" },
  { name: "MediaMTX", bodyKey: "guidesFooter.products.mediamtx" },
  { name: "CryptPad", bodyKey: "guidesFooter.products.cryptpad" },
] as const;

function GuidesAbout() {
  const { t } = useTranslation();
  return (
    <section className="mt-10 max-w-3xl border-t border-border pt-8 md:mt-12">
      <p className="text-sm leading-relaxed text-foreground md:text-base">
        {t("guidesFooter.lead")}
      </p>

      {/* Collapsed by default; native disclosure keeps it JS-free. */}
      <details className="group mt-5 rounded-lg border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-base font-semibold select-none [&::-webkit-details-marker]:hidden">
          {t("footer.tellMore")}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4">
          {PRODUCTS.map((p) => (
            <div key={p.name}>
              <SectionLabel as="h3" className="mt-4">
                {p.name}
              </SectionLabel>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t(p.bodyKey)}
              </p>
            </div>
          ))}

          <SectionLabel as="h3" className="mt-5">
            {t("guidesFooter.devTitle")}
          </SectionLabel>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t("guidesFooter.devBody")}
          </p>

          <SectionLabel as="h3" className="mt-4">
            {t("guidesFooter.wantTitle")}
          </SectionLabel>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t("guidesFooter.wantBody")}
          </p>
        </div>
      </details>
    </section>
  );
}
