import { Fragment, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Code2, Compass } from "lucide-react";
import { BookCard } from "@/components/shell/BookCard";
import { OrientationModal } from "@/components/shell/OrientationModal";
import { orientationSeen, markOrientationSeen } from "@/lib/orientationFlows";
import { ShelfHero } from "@/components/shell/ShelfHero";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SectionLabel } from "@/components/ui/section-label";
import { CARD_IMAGES } from "@/lib/cardImages";
import { bookDescription } from "@/lib/bookDescription";
import { loadManifest } from "@/lib/content/loader";
import { devNavSections } from "@/lib/devNav";
import { PAGE_FRAME } from "@/lib/pageFrame";
import { cn } from "@/lib/utils";
import { afterViewTransition } from "@/lib/viewTransition";

export const Route = createFileRoute("/$locale/dev/")({
  loader: async ({ context }) => {
    const manifest = await loadManifest(context.locale);
    return { sections: devNavSections(manifest) };
  },
  component: DevShelf,
});

function DevShelf() {
  const { t } = useTranslation();
  const { locale } = Route.useParams();
  const { sections } = Route.useLoaderData();
  // Wait for the shelf slide to end, or the sliding page paints over the drawer.
  const [orientOpen, setOrientOpen] = useState(false);
  useEffect(() => {
    if (orientationSeen()) return;
    let cancelled = false;
    void afterViewTransition().then(() => {
      if (!cancelled) setOrientOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <ShelfHero title={t("nav.develop")} />
      <div className={cn(PAGE_FRAME, "pt-4 pb-8 md:pt-6 md:pb-10")}>
        <p className="max-w-3xl text-sm leading-relaxed text-foreground md:text-base">
          {t("devFooter.leadBefore")}
          <strong className="font-semibold">
            {t("devFooter.leadEmphasis")}
          </strong>
          {t("devFooter.leadAfter")}
        </p>
        <button
          type="button"
          onClick={() => setOrientOpen(true)}
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Compass className="size-3.5 text-primary" />
          {t("orient.revisit")}
        </button>
        {sections.map((section) => (
          <Fragment key={section.key}>
            <SectionLabel className="px-1 pt-6 pb-2">
              {t(section.labelKey)}
            </SectionLabel>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:gap-3 lg:grid-cols-3">
              {section.books.map(({ book }) => (
                <BookCard
                  key={book.slug}
                  locale={locale}
                  to="/$locale/$"
                  splat={book.slug}
                  icon={Code2}
                  title={book.label}
                  description={bookDescription(t, book)}
                  image={CARD_IMAGES[book.slug]}
                />
              ))}
            </div>
          </Fragment>
        ))}
      </div>
      <SiteFooter agentExample={t("agentNote.exampleDev")} />
      <OrientationModal
        open={orientOpen}
        start="selector"
        onOpenChange={(o) => {
          setOrientOpen(o);
          if (!o) markOrientationSeen();
        }}
      />
    </div>
  );
}
