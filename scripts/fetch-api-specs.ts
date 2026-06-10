#!/usr/bin/env tsx

/**
 * Fetch versioned OpenAPI specs for the embedded API reference.
 *
 * Sources come from config/collections.ts (API_SPEC_SOURCES):
 *  - kind "gh-pages":       GET a single spec URL -> {id}/latest.json
 *  - kind "release-assets": GitHub releases of `repo`, downloading
 *                           `assetPath` per release (newest first, up to
 *                           maxVersions) -> {id}/{tag}.json
 *
 * Outputs:
 *   public/api-specs/{id}/{tag-or-latest}.json
 *   public/api-specs/manifest.json
 *
 * Network failures are warnings: a source degrades to empty versions and the
 * script ALWAYS exits 0 — site builds must not break on missing specs.
 *
 * Usage:
 *   pnpm fetch:api-specs            # GITHUB_TOKEN optional (rate limits)
 */

import "dotenv/config";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { API_SPEC_SOURCES, type ApiSpecSource } from "../config/collections";
import { writeJson } from "./lib/sync-helpers";

const DEFAULT_MAX_VERSIONS = 5;

export interface SpecVersion {
  tag: string;
  /** Filename inside public/api-specs/{id}/. */
  specFile: string;
  publishedAt?: string;
}

export interface SpecManifestSource {
  id: string;
  name: string;
  versions: SpecVersion[];
}

export interface ApiSpecsManifest {
  generatedAt: string;
  sources: SpecManifestSource[];
}

interface GitHubRelease {
  tag_name: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: Array<{ name: string; browser_download_url: string }>;
}

function gitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "react-opendefence-docs-build",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Keep release tags filesystem-safe ("v1.2.3" stays as-is). */
function safeTag(tag: string): string {
  return tag.replace(/[^A-Za-z0-9._-]/g, "-");
}

// Download + parse a spec; returns undefined (with a warning) on any failure.
async function downloadSpec(
  url: string,
  fetchImpl: typeof fetch,
  headers?: Record<string, string>,
): Promise<unknown | undefined> {
  try {
    const response = await fetchImpl(url, { headers, redirect: "follow" });
    if (!response.ok) {
      console.warn(
        `  ⚠ ${url} returned ${response.status} ${response.statusText}`,
      );
      return undefined;
    }
    return JSON.parse(await response.text());
  } catch (error) {
    console.warn(
      `  ⚠ Failed to fetch ${url}:`,
      error instanceof Error ? error.message : error,
    );
    return undefined;
  }
}

async function fetchGhPagesSource(
  source: ApiSpecSource,
  outDir: string,
  fetchImpl: typeof fetch,
): Promise<SpecVersion[]> {
  if (!source.url) {
    console.warn(`  ⚠ Source ${source.id} (gh-pages) has no url configured`);
    return [];
  }
  const spec = await downloadSpec(source.url, fetchImpl);
  if (spec === undefined) return [];

  await writeJson(path.join(outDir, source.id, "latest.json"), spec);

  // Some generators stamp the spec; surface it as publishedAt when present.
  const generated =
    typeof spec === "object" && spec !== null
      ? (spec as Record<string, unknown>)["x-generated-date"]
      : undefined;

  return [
    {
      tag: "latest",
      specFile: "latest.json",
      ...(typeof generated === "string" ? { publishedAt: generated } : {}),
    },
  ];
}

async function fetchReleaseAssetsSource(
  source: ApiSpecSource,
  outDir: string,
  fetchImpl: typeof fetch,
): Promise<SpecVersion[]> {
  if (!source.repo || !source.assetPath) {
    console.warn(
      `  ⚠ Source ${source.id} (release-assets) needs repo + assetPath configured`,
    );
    return [];
  }

  const maxVersions = source.maxVersions ?? DEFAULT_MAX_VERSIONS;
  const headers = gitHubHeaders();
  const versions: SpecVersion[] = [];

  let releases: GitHubRelease[];
  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${source.repo}/releases?per_page=100`,
      { headers },
    );
    if (!response.ok) {
      console.warn(
        `  ⚠ GitHub API returned ${response.status} for ${source.repo} releases`,
      );
      return versions;
    }
    releases = (await response.json()) as GitHubRelease[];
  } catch (error) {
    console.warn(
      `  ⚠ Failed to list releases for ${source.repo}:`,
      error instanceof Error ? error.message : error,
    );
    return versions;
  }

  // GitHub returns newest first; skip drafts, download until maxVersions.
  for (const release of releases) {
    if (versions.length >= maxVersions) break;
    if (release.draft) continue;

    const asset = release.assets.find(
      (a) =>
        a.name === source.assetPath ||
        a.browser_download_url.endsWith(`/${source.assetPath}`),
    );
    if (!asset) {
      console.warn(
        `  ⚠ Release ${release.tag_name} of ${source.repo} has no ${source.assetPath}`,
      );
      continue;
    }

    const spec = await downloadSpec(
      asset.browser_download_url,
      fetchImpl,
      headers,
    );
    if (spec === undefined) continue;

    const specFile = `${safeTag(release.tag_name)}.json`;
    await writeJson(path.join(outDir, source.id, specFile), spec);
    versions.push({
      tag: release.tag_name,
      specFile,
      ...(release.published_at ? { publishedAt: release.published_at } : {}),
    });
  }

  return versions;
}

/**
 * Fetch all spec sources into outDir and return the manifest. Every failure
 * path degrades to an empty versions array — this function never throws for
 * network reasons.
 */
export async function fetchApiSpecs(
  sources: readonly ApiSpecSource[],
  outDir: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiSpecsManifest> {
  const manifestSources: SpecManifestSource[] = [];

  for (const source of sources) {
    console.log(`Fetching specs for ${source.name} (${source.kind})...`);
    let versions: SpecVersion[] = [];
    try {
      versions =
        source.kind === "gh-pages"
          ? await fetchGhPagesSource(source, outDir, fetchImpl)
          : await fetchReleaseAssetsSource(source, outDir, fetchImpl);
    } catch (error) {
      console.warn(
        `  ⚠ Unexpected failure for ${source.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
    console.log(`  ${versions.length} version(s) saved`);
    manifestSources.push({ id: source.id, name: source.name, versions });
  }

  const manifest: ApiSpecsManifest = {
    generatedAt: new Date().toISOString(),
    sources: manifestSources,
  };
  await writeJson(path.join(outDir, "manifest.json"), manifest);
  return manifest;
}

async function main() {
  const outDir = path.join(process.cwd(), "public", "api-specs");
  const manifest = await fetchApiSpecs(API_SPEC_SOURCES, outDir);
  const total = manifest.sources.reduce((n, s) => n + s.versions.length, 0);
  console.log(
    `\nAPI spec manifest written (${manifest.sources.length} sources, ${total} versions)`,
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  // Never break the build over missing specs.
  main().catch((err) => {
    console.warn("fetch-api-specs failed (continuing):", err.message || err);
  });
}
