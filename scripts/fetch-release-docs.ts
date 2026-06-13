#!/usr/bin/env tsx

/**
 * Fetch release-dependent docs (release notes + changelog) for the on-site
 * "Releases" area. Mirrors fetch-api-specs.ts.
 *
 * Sources come from config/collections.ts (RELEASE_DOC_SOURCES). Per component:
 *  - GitHub Release bodies (primary): list `repo` releases, skip drafts,
 *    newest-first up to maxVersions -> releases/{tag}.json (body -> sanitized HTML)
 *  - CHANGELOG.md (full history) via raw.githubusercontent -> changelog.json
 *  - RELEASE_NOTES.md (optional human prose) via raw       -> release-notes.json
 *
 * Markdown is rendered to sanitized HTML AT FETCH TIME with the shared
 * renderInlineMarkdown pipeline, so the on-site renderer reuses HtmlBlock and
 * the repo's "sanitize at build time, no runtime sanitization" invariant holds.
 *
 * Outputs:
 *   public/release-docs/{id}/releases/{tag}.json
 *   public/release-docs/{id}/changelog.json       (if CHANGELOG.md present)
 *   public/release-docs/{id}/release-notes.json    (if RELEASE_NOTES.md present)
 *   public/release-docs/manifest.json
 *
 * Network failures are warnings: a source degrades to empty and the script
 * ALWAYS exits 0 — site builds must not break on missing release docs.
 *
 * Usage:
 *   pnpm fetch:release-docs   # GITHUB_TOKEN optional (rate limits / private repos)
 */

import "dotenv/config";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  RELEASE_DOC_SOURCES,
  type ReleaseDocSource,
} from "../config/collections";
import { renderInlineMarkdown } from "./lib/block-emitter";
import { writeJson } from "./lib/sync-helpers";

const DEFAULT_MAX_VERSIONS = 10;
const DEFAULT_BRANCH = "main";
const DEFAULT_CHANGELOG = "CHANGELOG.md";
const DEFAULT_RELEASE_NOTES = "RELEASE_NOTES.md";

export interface ReleaseEntry {
  tag: string;
  /** Filename inside public/release-docs/{id}/releases/. */
  file: string;
  publishedAt?: string;
  prerelease?: boolean;
}

export interface ReleaseDocComponent {
  id: string;
  name: string;
  repo: string;
  /** Newest-first, capped at maxVersions. */
  releases: ReleaseEntry[];
  /** "changelog.json" if a CHANGELOG.md was found. */
  changelogFile?: string;
  /** "release-notes.json" if a RELEASE_NOTES.md was found. */
  releaseNotesFile?: string;
}

export interface ReleaseDocsManifest {
  generatedAt: string;
  components: ReleaseDocComponent[];
}

interface GitHubRelease {
  tag_name: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
  body: string | null;
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

/** Keep release tags filesystem-safe ("1.2.3" stays as-is; "v1.2.3" too). */
function safeTag(tag: string): string {
  return tag.replace(/[^A-Za-z0-9._-]/g, "-");
}

// Download text (markdown); returns undefined (with a warning) on any failure.
// A 404 is expected (optional files) and stays quiet.
async function downloadText(
  url: string,
  fetchImpl: typeof fetch,
  headers?: Record<string, string>,
): Promise<string | undefined> {
  try {
    const response = await fetchImpl(url, { headers, redirect: "follow" });
    if (!response.ok) {
      if (response.status !== 404) {
        console.warn(
          `  ⚠ ${url} returned ${response.status} ${response.statusText}`,
        );
      }
      return undefined;
    }
    return await response.text();
  } catch (error) {
    console.warn(
      `  ⚠ Failed to fetch ${url}:`,
      error instanceof Error ? error.message : error,
    );
    return undefined;
  }
}

async function renderToFile(
  markdown: string,
  filePath: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  const html = await renderInlineMarkdown(markdown);
  await writeJson(filePath, { ...meta, html });
}

async function fetchReleaseBodies(
  source: ReleaseDocSource,
  outDir: string,
  fetchImpl: typeof fetch,
): Promise<ReleaseEntry[]> {
  const maxVersions = source.maxVersions ?? DEFAULT_MAX_VERSIONS;
  const headers = gitHubHeaders();
  const entries: ReleaseEntry[] = [];

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
      return entries;
    }
    releases = (await response.json()) as GitHubRelease[];
  } catch (error) {
    console.warn(
      `  ⚠ Failed to list releases for ${source.repo}:`,
      error instanceof Error ? error.message : error,
    );
    return entries;
  }

  // GitHub returns newest first; skip drafts and empty notes, render to cap.
  for (const release of releases) {
    if (entries.length >= maxVersions) break;
    if (release.draft) continue;
    const body = release.body?.trim();
    if (!body) continue;

    const file = `${safeTag(release.tag_name)}.json`;
    const meta = {
      tag: release.tag_name,
      ...(release.published_at ? { publishedAt: release.published_at } : {}),
      ...(release.prerelease ? { prerelease: true } : {}),
    };
    await renderToFile(
      body,
      path.join(outDir, source.id, "releases", file),
      meta,
    );
    entries.push({ file, ...meta } as ReleaseEntry);
  }

  return entries;
}

async function fetchRawDoc(
  source: ReleaseDocSource,
  repoPath: string,
  outFile: string,
  outDir: string,
  fetchImpl: typeof fetch,
): Promise<string | undefined> {
  const branch = source.branch ?? DEFAULT_BRANCH;
  const url = `https://raw.githubusercontent.com/${source.repo}/${branch}/${repoPath}`;
  // Send auth headers too — raw.githubusercontent needs them for private repos.
  const markdown = await downloadText(url, fetchImpl, gitHubHeaders());
  if (markdown === undefined || markdown.trim() === "") return undefined;
  await renderToFile(markdown, path.join(outDir, source.id, outFile));
  return outFile;
}

/**
 * Fetch all release-doc sources into outDir and return the manifest. Every
 * failure path degrades to empty — this function never throws for network
 * reasons.
 */
export async function fetchReleaseDocs(
  sources: readonly ReleaseDocSource[],
  outDir: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReleaseDocsManifest> {
  const components: ReleaseDocComponent[] = [];

  for (const source of sources) {
    console.log(`Fetching release docs for ${source.name} (${source.repo})...`);
    let releases: ReleaseEntry[] = [];
    let changelogFile: string | undefined;
    let releaseNotesFile: string | undefined;
    try {
      releases = await fetchReleaseBodies(source, outDir, fetchImpl);
      changelogFile = await fetchRawDoc(
        source,
        source.changelogPath ?? DEFAULT_CHANGELOG,
        "changelog.json",
        outDir,
        fetchImpl,
      );
      releaseNotesFile = await fetchRawDoc(
        source,
        source.releaseNotesPath ?? DEFAULT_RELEASE_NOTES,
        "release-notes.json",
        outDir,
        fetchImpl,
      );
    } catch (error) {
      console.warn(
        `  ⚠ Unexpected failure for ${source.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
    console.log(
      `  ${releases.length} release(s)` +
        `${changelogFile ? " + changelog" : ""}` +
        `${releaseNotesFile ? " + notes" : ""}`,
    );
    components.push({
      id: source.id,
      name: source.name,
      repo: source.repo,
      releases,
      ...(changelogFile ? { changelogFile } : {}),
      ...(releaseNotesFile ? { releaseNotesFile } : {}),
    });
  }

  const manifest: ReleaseDocsManifest = {
    generatedAt: new Date().toISOString(),
    components,
  };
  await writeJson(path.join(outDir, "manifest.json"), manifest);
  return manifest;
}

async function main() {
  const outDir = path.join(process.cwd(), "public", "release-docs");
  const manifest = await fetchReleaseDocs(RELEASE_DOC_SOURCES, outDir);
  const total = manifest.components.reduce((n, c) => n + c.releases.length, 0);
  console.log(
    `\nRelease docs manifest written (${manifest.components.length} components, ${total} releases)`,
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  // Never break the build over missing release docs.
  main().catch((err) => {
    console.warn("fetch-release-docs failed (continuing):", err.message || err);
  });
}
