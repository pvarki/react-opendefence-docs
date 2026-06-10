/**
 * Canonical slideset format (NEW authoring convention, no legacy precedent):
 *
 *   # Doc Title            <- ordinary intro, stays on the page
 *   META: slides           <- marker line, anywhere before the first H2
 *   Some intro prose.
 *   ## Step one            <- each H2 starts a slide
 *   ![alt](/img/1.webp)    <- first image in the section = the slide image
 *   Body of step one.
 *   ## Step two
 *   ...
 *
 * Everything from the first H2 onward is consumed into slides; the content
 * before it (minus the META line) is returned as the remaining intro
 * markdown. The caller appends its own %%SLIDESET:...%% placeholder.
 */
import type { RawSlide, RawSlideset } from "./types";

/** "META: slides" / "META: slideset", case-insensitive. */
const META_SLIDES_RE = /^\s*META:\s*(?:slides|slideset)\s*$/i;
const H2_RE = /^##\s+(.+)$/;
/** First markdown image in a step section (size titles like " =1080x2006" tolerated). */
const IMAGE_RE = /!\[[^\]]*\]\(([^()\s]+)(?:\s+"[^"]*")?\)/;

function parseStep(title: string, body: string): RawSlide {
  const imageRefs: string[] = [];
  let bodyMarkdown = body;

  const imgMatch = bodyMarkdown.match(IMAGE_RE);
  if (imgMatch) {
    imageRefs.push(imgMatch[1]);
    bodyMarkdown = bodyMarkdown.replace(imgMatch[0], "");
  }

  return {
    title: title.trim(),
    layout: imageRefs.length > 0 ? "image-bottom" : "text",
    bodyMarkdown: bodyMarkdown.replace(/\n{3,}/g, "\n\n").trim(),
    imageRefs,
  };
}

/**
 * When the META marker is present, consume the H2 steps into a slideset.
 * Without the marker (or without any H2 to build slides from) the document
 * is returned unchanged apart from removing the marker line itself.
 */
export function extractCanonicalSlideset(markdown: string): {
  markdown: string;
  slideset?: RawSlideset;
} {
  const lines = markdown.split("\n");
  const firstH2 = lines.findIndex((l) => H2_RE.test(l));
  const introEnd = firstH2 === -1 ? lines.length : firstH2;

  const metaIdx = lines
    .slice(0, introEnd)
    .findIndex((l) => META_SLIDES_RE.test(l));
  if (metaIdx === -1) {
    return { markdown };
  }

  const intro = lines
    .slice(0, introEnd)
    .filter((_, i) => i !== metaIdx)
    .join("\n");

  if (firstH2 === -1) {
    // Marker but nothing to slice into slides — drop only the marker.
    return { markdown: intro };
  }

  const slides: RawSlide[] = [];
  let title: string | null = null;
  let body: string[] = [];
  for (let i = firstH2; i < lines.length; i++) {
    const h2 = lines[i].match(H2_RE);
    if (h2) {
      if (title !== null) slides.push(parseStep(title, body.join("\n")));
      title = h2[1];
      body = [];
    } else {
      body.push(lines[i]);
    }
  }
  if (title !== null) slides.push(parseStep(title, body.join("\n")));

  return {
    markdown: `${intro.replace(/\n+$/, "")}\n`,
    slideset: { source: "canonical", slides },
  };
}
