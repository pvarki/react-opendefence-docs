import { Fragment, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import type { Block } from "@shared/content-schema";
import { useMediaPref } from "@/lib/videoPref";
import { useIsOnline, type VideoEntry } from "@/lib/videos";
import { HtmlBlock } from "@/components/blocks/HtmlBlock";
import { MermaidBlock } from "@/components/blocks/MermaidBlock";
import { YoutubeBlock } from "@/components/blocks/YoutubeBlock";
import { Slideset } from "@/components/slides/Slideset";

interface BlockRendererProps {
  blocks: Block[];
  /** This page's rendered video, when one exists. */
  video?: VideoEntry;
  /** The video was rendered from an older revision of the page. */
  videoStale?: boolean;
  /** False for the swiper's offscreen neighbour panes. */
  isCurrent?: boolean;
}

/**
 * Native disclosure offering the medium that isn't on screen. Its content is
 * kept unmounted until opened — a slideset and an iframe are both expensive,
 * and most readers never open the card. Opening it is a per-page detour: it
 * doesn't touch the global preference and dies with the pane.
 */
function MediaCard({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="group mt-8 rounded-lg border border-border bg-card"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-base font-semibold select-none [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      {open && <div className="pb-4">{children}</div>}
    </details>
  );
}

export function BlockRenderer({
  blocks,
  video,
  videoStale,
  isCurrent = true,
}: BlockRendererProps) {
  const { t } = useTranslation();
  const pref = useMediaPref();
  const isOnline = useIsOnline();
  const firstSlideset = blocks.findIndex((b) => b.type === "slideset");

  // The video stands in for the slideset, so a page without one has nowhere to
  // put it. That combination cannot occur: the catalogue upstream only makes a
  // video for a page that has a slideset. Offline the iframe would be a dead
  // box, so the slides win instead.
  const hasVideo = video !== undefined && firstSlideset !== -1;
  // `inert` hides the neighbour panes from the tab order but does not stop an
  // iframe loading, and lazy-loading's viewport margin is wider than a phone —
  // so without this every swipe would pull three YouTube embeds.
  const showVideo = hasVideo && pref === "videos" && isOnline && isCurrent;
  const blockedByOffline = hasVideo && pref === "videos" && !isOnline;

  const player = video && (
    <>
      <YoutubeBlock videoId={video.videoId} />
      {videoStale && (
        <p className="mb-6 text-sm text-muted-foreground">{t("media.stale")}</p>
      )}
    </>
  );

  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "html":
            return <HtmlBlock key={i} html={block.html} />;
          case "slideset":
            if (showVideo)
              return i === firstSlideset ? (
                <Fragment key={i}>{player}</Fragment>
              ) : null;
            return (
              <Fragment key={i}>
                {i === firstSlideset && blockedByOffline && (
                  <p className="mb-4 text-sm text-muted-foreground">
                    {t("media.needsConnection")}
                  </p>
                )}
                {/* Only the first slideset binds the ?slide=N deep link. */}
                <Slideset block={block} bindSlideParam={i === firstSlideset} />
              </Fragment>
            );
          case "image":
            return (
              <figure key={i} className="my-6">
                <img
                  src={block.src}
                  alt={block.alt}
                  width={block.width}
                  height={block.height}
                  loading="lazy"
                  className="rounded-lg border border-border"
                />
                {block.caption && (
                  <figcaption className="mt-2 text-sm text-muted-foreground">
                    {block.caption}
                  </figcaption>
                )}
              </figure>
            );
          case "code":
            return (
              <div
                key={i}
                className="my-6 text-sm"
                // shiki output, generated and sanitized at build time
                dangerouslySetInnerHTML={{ __html: block.html }}
              />
            );
          case "mermaid":
            return (
              <MermaidBlock key={i} code={block.code} title={block.title} />
            );
          case "youtube":
            return (
              <YoutubeBlock
                key={i}
                videoId={block.videoId}
                title={block.title}
              />
            );
          case "pdf":
            return (
              <a
                key={i}
                href={block.src}
                target="_blank"
                rel="noopener noreferrer"
                className="my-6 block rounded-lg border border-border bg-card px-4 py-3 text-primary hover:border-primary"
              >
                {block.title ?? block.src}
              </a>
            );
        }
      })}

      {/* Offline the card would only offer a dead player, so it stays away. */}
      {hasVideo && isOnline && isCurrent && (
        <MediaCard label={showVideo ? t("media.readSlides") : t("media.watch")}>
          {showVideo
            ? blocks.map((block, i) =>
                block.type === "slideset" ? (
                  // The card holds the only deck mounted in video mode, so it
                  // is the one that must honour and update ?slide=N.
                  <Slideset
                    key={i}
                    block={block}
                    bindSlideParam={i === firstSlideset}
                  />
                ) : null,
              )
            : player}
        </MediaCard>
      )}
    </>
  );
}
