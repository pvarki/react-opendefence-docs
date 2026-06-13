import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  BookText,
  Braces,
  ChevronDown,
  Code2,
  Smartphone,
  Tag,
} from "lucide-react";
import type { ManifestCollection } from "@shared/content-schema";
import { BookCard } from "@/components/shell/BookCard";
import { ShelfHero } from "@/components/shell/ShelfHero";
import { CARD_IMAGES } from "@/lib/cardImages";
import { loadManifest } from "@/lib/content/loader";
import { siteSections } from "@/lib/siteSections";

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
    <div className="h-full overflow-y-auto">
      <ShelfHero
        src="/images/guides.jpeg"
        title={t("nav.guides")}
        position="object-[center_80%]"
      />
      <div className="mx-auto max-w-3xl px-4 py-4 md:py-8">
        {sections.map((section) => (
          <Fragment key={section.titleKey}>
            <h2 className="px-1 pt-5 pb-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
              {t(section.titleKey)}
            </h2>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
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
              {section.withApiReference && (
                <BookCard
                  locale={locale}
                  to="/$locale/dev/api"
                  icon={Braces}
                  title="API Reference"
                  description="rasenmaeher-api & integration APIs (OpenAPI)"
                />
              )}
              {section.withReleases && (
                <BookCard
                  locale={locale}
                  to="/$locale/dev/releases"
                  icon={Tag}
                  title="Releases"
                  description="Changelogs & release notes per component"
                />
              )}
            </div>
          </Fragment>
        ))}
      </div>
      <GuidesFooter />
    </div>
  );
}

/** Product integrations covered by the guides, with a one-line credit each. */
const PRODUCTS = [
  {
    name: "TAK",
    body: "Developed by the TAK Product Center (TPC), a U.S. Government organization. The OpenDefence-developed integration gets your ATAK users connected to the server by a double-tap self service — yes, press two buttons and you're in.",
  },
  {
    name: "Matrix",
    body: "An open, decentralized messaging protocol from the Matrix.org Foundation; clients such as Element X are spearheaded by New Vector Ltd. The OpenDefence-developed integration lets users connect their Element X client to the Deploy App-bundled Synapse server by simply pasting in the server address.",
  },
  {
    name: "MediaMTX",
    body: "A real-time media server: a video-sharing service that lets you quickly share video from e.g. drone operators. The OpenDefence-developed integration lets you start streaming with your OpenTAK ICU and UAS Tool applications by tapping an import-settings button once.",
  },
  {
    name: "CryptPad",
    body: "Developed by XWiki SAS, CryptPad is an end-to-end-encrypted collaboration and file-sharing suite used by, among others, the European Commission.",
  },
];

/** Guides-page footer, styled like the Deploy App (home) footer. */
function GuidesFooter() {
  const { t } = useTranslation();
  return (
    <footer className="mt-4 border-t border-border bg-card md:mt-8">
      <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
        <p className="text-sm leading-relaxed text-foreground">
          Deploy App has a number of official product integrations, each
          currently developed by OpenDefence. Here you can find guides to use
          the official products efficiently.
        </p>

        {/* Collapsed by default; native disclosure keeps it JS-free. */}
        <details className="group mt-5 rounded-lg border border-border bg-background">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-base font-semibold select-none [&::-webkit-details-marker]:hidden">
            {t("footer.tellMore")}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4">
            {PRODUCTS.map((p) => (
              <div key={p.name}>
                <p className="mt-4 text-[11px] font-semibold tracking-widest text-primary uppercase">
                  {p.name}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </div>
            ))}

            <p className="mt-5 text-[11px] font-semibold tracking-widest text-primary uppercase">
              OpenDefence as integration developer
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              We develop product integrations for Deploy App to give soldiers a
              strong stack of services. These integrations are open source, just
              like core Deploy App — and you are invited to collaborate with us.
            </p>

            <p className="mt-4 text-[11px] font-semibold tracking-widest text-primary uppercase">
              Want to see your product here?
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              OpenDefence aims to make Deploy App a true interface for deploying
              apps to soldiers. That works when you can fork our core, build
              your integration yourself, and then either contact us for official
              integration status or agree to deliver your app to your
              armed-forces customer on our open-source tech.
            </p>
          </div>
        </details>
      </div>
    </footer>
  );
}
