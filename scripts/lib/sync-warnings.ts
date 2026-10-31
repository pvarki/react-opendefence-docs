/**
 * Hand-off from the sync run to the validation report: the sync writes
 * which collections it had to skip and which pages it could not download,
 * `validate:docs --report` puts them in the sync PR body. The file is git-ignored and rewritten on every sync.
 */
import fs from "node:fs/promises";
import path from "node:path";

export const SYNC_WARNINGS_FILE = "sync-warnings.json";

export interface SyncWarnings {
  generatedAt: string;
  /** "Label (slug): error" of collections skipped as unreadable. */
  skippedCollections: string[];
  /** "Collection: page title: error" of pages that kept their old content. */
  failedPages?: string[];
}

/** Failed pages listed in the PR body; the run log has the rest. */
export const MAX_FAILED_PAGES_LISTED = 50;

export function syncWarningsPath(cwd = process.cwd()): string {
  return path.join(cwd, SYNC_WARNINGS_FILE);
}

export async function writeSyncWarnings(
  warnings: SyncWarnings,
  cwd?: string,
): Promise<void> {
  await fs.writeFile(
    syncWarningsPath(cwd),
    JSON.stringify(warnings, null, 2) + "\n",
    "utf-8",
  );
}

export async function clearSyncWarnings(cwd?: string): Promise<void> {
  await fs.rm(syncWarningsPath(cwd), { force: true });
}

/** The last sync's warnings, or undefined when there is no (valid) file. */
export async function readSyncWarnings(
  cwd?: string,
): Promise<SyncWarnings | undefined> {
  try {
    const data = JSON.parse(await fs.readFile(syncWarningsPath(cwd), "utf-8"));
    if (
      typeof data?.generatedAt === "string" &&
      Array.isArray(data?.skippedCollections)
    ) {
      return data as SyncWarnings;
    }
  } catch {
    // Missing or unreadable: the report just has no sync section.
  }
  return undefined;
}

/** Report sections for the sync PR body; empty when nothing went wrong. */
export function renderSyncWarnings(
  warnings: SyncWarnings | undefined,
): string[] {
  if (!warnings) return [];
  const lines: string[] = [];
  if (warnings.skippedCollections.length > 0) {
    lines.push(
      "## Skipped collections",
      "",
      `The sync at ${warnings.generatedAt} could not read these collections from Outline, so their content on the site was not updated:`,
      "",
      ...warnings.skippedCollections.map((line) => `- ${line}`),
      "",
    );
  }
  const failed = warnings.failedPages ?? [];
  if (failed.length > 0) {
    const listed = failed.slice(0, MAX_FAILED_PAGES_LISTED);
    lines.push(
      "## Failed pages",
      "",
      `The sync at ${warnings.generatedAt} could not download these pages from Outline, so they keep their previous content on the site:`,
      "",
      ...listed.map((line) => `- ${line}`),
    );
    if (failed.length > listed.length) {
      lines.push(
        `- …and ${failed.length - listed.length} more, listed in the run log.`,
      );
    }
    lines.push("");
  }
  return lines;
}
