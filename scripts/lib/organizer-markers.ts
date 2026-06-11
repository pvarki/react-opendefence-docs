/**
 * Editor-facing markers in ORGANIZER doc bodies (docs that nest other docs).
 * Authors type these as plain lines in Outline:
 *
 *   META: toporg                — this organizer is a section heading that
 *                                 groups chapters (e.g. INTRODUCTION,
 *                                 USAGE BY ROLE) instead of being a chapter.
 *   META: platform: android     — this organizer is a selectable client for
 *                                 that platform (overrides/augments name
 *                                 detection like ATAK -> android).
 *   (this tab/page is under development)
 *                               — surfaces as the selector's tag telling the
 *                                 reader this client has missing sections.
 */
import { PLATFORMS, type Platform } from "../../shared/content-schema";
import { isUnderDevelopment } from "./block-emitter";

export interface OrganizerMarkers {
  toporg: boolean;
  platform?: Platform;
  underDevelopment: boolean;
}

const TOPORG_RE = /^META:\s*toporg\s*$/im;
const PLATFORM_RE = /^META:\s*platform:\s*([a-z]+)\s*$/im;

export function parseOrganizerMarkers(markdown: string): OrganizerMarkers {
  const platformMatch = markdown.match(PLATFORM_RE);
  const platform = PLATFORMS.find(
    (p) => p === platformMatch?.[1]?.toLowerCase(),
  );
  return {
    toporg: TOPORG_RE.test(markdown),
    ...(platform ? { platform } : {}),
    underDevelopment: isUnderDevelopment(markdown),
  };
}
