/**
 * Editor-facing markers in ORGANIZER doc bodies (docs that nest other docs).
 * Authors type these as plain lines in Outline:
 *
 *   META: toporg                — this organizer is a section heading that
 *                                 groups chapters (e.g. INTRODUCTION,
 *                                 USAGE BY ROLE) instead of being a chapter.
 *   META: platforms-container   — this organizer is the "Platforms" wrapper
 *                                 expected directly under a locale root. Its
 *                                 children are platform organizers. The sync
 *                                 recurses into it without treating it as a
 *                                 client itself.
 *   META: platform: android     — this organizer is a selectable client for
 *                                 that platform (overrides/augments name
 *                                 detection like ATAK -> android).
 *   META: os: android           — the underlying OS of a product client
 *                                 (e.g. ATAK runs on android). Used for icon
 *                                 selection and platform-filter routing.
 *                                 Must be one of the Platform enum values.
 *   META: product: yes          — this client is a named product (e.g. ATAK,
 *                                 WinTAK) rather than a generic OS platform.
 *                                 Requires META: os to set the icon.
 *   META: incomplete            — this client's content has gaps; readers
 *                                 see a red "Incomplete" tag in platform
 *                                 lists. "(incomplete)" anywhere in the body
 *                                 and the legacy under-development phrases
 *                                 work too.
 *   (this tab/page is under development)
 *                               — legacy form of the same flag.
 */
import { PLATFORMS, type Platform } from "../../shared/content-schema";
import { isUnderDevelopment } from "./block-emitter";

export interface OrganizerMarkers {
  toporg: boolean;
  /** Body contains META: platforms-container — recurse without treating as client. */
  platformsContainer: boolean;
  /** Body contains META: platform: <os-key> — declares the OS-level platform. */
  platform?: Platform;
  /** Body contains META: os: <os-key> — explicit underlying OS for product clients. */
  os?: Platform;
  /** Body contains META: product: yes — this is a named product, not a generic OS. */
  isProduct: boolean;
  underDevelopment: boolean;
}

const TOPORG_RE = /^META:\s*toporg\s*$/im;
const PLATFORMS_CONTAINER_RE = /^META:\s*platforms-container\s*$/im;
const PLATFORM_RE = /^META:\s*platform:\s*([a-z-]+)\s*$/im;
const OS_RE = /^META:\s*os:\s*([a-z]+)\s*$/im;
const PRODUCT_RE = /^META:\s*product:\s*yes\s*$/im;
const INCOMPLETE_RE = /^META:\s*incomplete\s*$|\(incomplete\)/im;

export function parseOrganizerMarkers(markdown: string): OrganizerMarkers {
  const platformMatch = markdown.match(PLATFORM_RE);
  const platform = PLATFORMS.find(
    (p) => p === platformMatch?.[1]?.toLowerCase(),
  );
  const osMatch = markdown.match(OS_RE);
  const os = PLATFORMS.find((p) => p === osMatch?.[1]?.toLowerCase());
  return {
    toporg: TOPORG_RE.test(markdown),
    platformsContainer: PLATFORMS_CONTAINER_RE.test(markdown),
    ...(platform ? { platform } : {}),
    ...(os ? { os } : {}),
    isProduct: PRODUCT_RE.test(markdown),
    underDevelopment:
      isUnderDevelopment(markdown) || INCOMPLETE_RE.test(markdown),
  };
}
