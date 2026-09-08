import { Fragment, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Code2, Compass } from "lucide-react";
import { BookCard } from "@/components/shell/BookCard";
import { OrientationModal } from "@/components/shell/OrientationModal";
import { orientationSeen, markOrientationSeen } from "@/lib/orientationFlows";
import { AgentFriendlyNote } from "@/components/shell/AgentFriendlyNote";
import { ShelfHero } from "@/components/shell/ShelfHero";
import { CARD_IMAGES } from "@/lib/cardImages";
import { SidebarNav } from "@/components/shell/SidebarNav";
import { loadManifest } from "@/lib/content/loader";
import { devNavSections } from "@/lib/devNav";

export const Route = createFileRoute("/$locale/dev/")({
  loader: async ({ context }) => {
    const manifest = await loadManifest(context.locale);
    return {
      manifest,
      contentLocale: context.locale,
      sections: devNavSections(manifest),
    };
  },
  component: DevShelf,
});

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-1 pt-6 pb-2 text-[11px] font-semibold tracking-widest text-primary uppercase">
      {children}
    </h2>
  );
}

function DevShelf() {
  const { t } = useTranslation();
  const { locale } = Route.useParams();
  const { manifest, contentLocale, sections } = Route.useLoaderData();
  // Auto-open the orientation flow once per visitor (lazy init, like IntroModal).
  const [orientOpen, setOrientOpen] = useState(() => !orientationSeen());

  return (
    <div className="flex h-full">
      <SidebarNav
        locale={locale}
        contentLocale={contentLocale}
        manifest={manifest}
        section="dev"
      />
      <div className="min-w-0 flex-1 overflow-y-auto">
        <ShelfHero
          src="/images/develop.jpeg"
          title={t("nav.develop")}
          position="object-[center_80%]"
        />
        <div className="mx-auto max-w-3xl px-4 py-4 md:py-8">
          <p className="text-sm leading-relaxed text-foreground">
            {t("devFooter.leadBefore")}
            <strong className="font-semibold text-primary">
              {t("devFooter.leadEmphasis")}
            </strong>
            {t("devFooter.leadAfter")}
          </p>
          <button
            type="button"
            onClick={() => setOrientOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Compass className="size-3.5 text-primary" />
            {t("orient.revisit")}
          </button>
          {sections.map((section) => (
            <Fragment key={section.key}>
              <SectionHeading>{t(section.labelKey)}</SectionHeading>
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
                {section.books.map(({ book }) => (
                  <BookCard
                    key={book.slug}
                    locale={locale}
                    to="/$locale/$"
                    splat={book.slug}
                    icon={Code2}
                    title={book.label}
                    description={book.description}
                    image={CARD_IMAGES[book.slug]}
                  />
                ))}
              </div>
            </Fragment>
          ))}
        </div>
        <DevFooter />
      </div>
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

/** Develop-page foot: the lead now sits up top; only the agent note remains. */
function DevFooter() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl px-4 pb-8">
      <AgentFriendlyNote example={t("agentNote.exampleDev")} />
    </div>
  );
}
