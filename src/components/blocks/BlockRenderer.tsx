import { useTranslation } from "react-i18next";
import type { Block } from "@shared/content-schema";
import { HtmlBlock } from "@/components/blocks/HtmlBlock";
import { MermaidBlock } from "@/components/blocks/MermaidBlock";
import { Slideset } from "@/components/slides/Slideset";

export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  const { t } = useTranslation();
  const firstSlideset = blocks.findIndex((b) => b.type === "slideset");

  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "html":
            return <HtmlBlock key={i} html={block.html} />;
          case "slideset":
            // Only the first slideset binds the ?slide=N deep link.
            return (
              <Slideset
                key={i}
                block={block}
                bindSlideParam={i === firstSlideset}
              />
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
              <div key={i} className="my-6 aspect-video">
                <iframe
                  className="h-full w-full rounded-lg border border-border"
                  src={`https://www.youtube-nocookie.com/embed/${block.videoId}`}
                  title={block.title ?? t("blocks.youtubeTitle")}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
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
    </>
  );
}
