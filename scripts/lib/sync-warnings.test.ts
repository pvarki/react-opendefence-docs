import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  MAX_FAILED_PAGES_LISTED,
  clearSyncWarnings,
  readSyncWarnings,
  renderSyncWarnings,
  syncWarningsPath,
  writeSyncWarnings,
} from "./sync-warnings";

async function tmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "sync-warnings-"));
}

describe("sync warnings file", () => {
  it("round-trips and clears", async () => {
    const dir = await tmpDir();
    const warnings = {
      generatedAt: "2026-10-31T12:00:00.000Z",
      skippedCollections: ["Architecture (architecture): 403 Forbidden"],
    };
    await writeSyncWarnings(warnings, dir);
    expect(await readSyncWarnings(dir)).toEqual(warnings);
    await clearSyncWarnings(dir);
    expect(await readSyncWarnings(dir)).toBeUndefined();
    await clearSyncWarnings(dir); // no file: no error
  });

  it("ignores a missing or malformed file", async () => {
    const dir = await tmpDir();
    expect(await readSyncWarnings(dir)).toBeUndefined();
    await fs.writeFile(syncWarningsPath(dir), "{not json", "utf-8");
    expect(await readSyncWarnings(dir)).toBeUndefined();
    await fs.writeFile(syncWarningsPath(dir), '{"generatedAt":1}', "utf-8");
    expect(await readSyncWarnings(dir)).toBeUndefined();
  });
});

describe("renderSyncWarnings", () => {
  it("renders nothing when no collection was skipped", () => {
    expect(renderSyncWarnings(undefined)).toEqual([]);
    expect(
      renderSyncWarnings({ generatedAt: "now", skippedCollections: [] }),
    ).toEqual([]);
  });

  it("lists each skipped collection", () => {
    const lines = renderSyncWarnings({
      generatedAt: "2026-10-31T12:00:00.000Z",
      skippedCollections: ["A (a): 403", "B (b): 404"],
    });
    expect(lines[0]).toBe("## Skipped collections");
    expect(lines).toContain("- A (a): 403");
    expect(lines).toContain("- B (b): 404");
  });
});

describe("renderSyncWarnings failed pages", () => {
  it("lists failed pages after skipped collections", () => {
    const lines = renderSyncWarnings({
      generatedAt: "2026-10-31T12:00:00.000Z",
      skippedCollections: ["A (a): 403"],
      failedPages: ["TAK Guide: Overview: Outline API error: 403"],
    });
    const skipped = lines.indexOf("## Skipped collections");
    const failed = lines.indexOf("## Failed pages");
    expect(skipped).toBe(0);
    expect(failed).toBeGreaterThan(skipped);
    expect(lines).toContain("- TAK Guide: Overview: Outline API error: 403");
  });

  it("renders failed pages without skipped collections", () => {
    const lines = renderSyncWarnings({
      generatedAt: "now",
      skippedCollections: [],
      failedPages: ["A: x: boom"],
    });
    expect(lines[0]).toBe("## Failed pages");
  });

  it("caps the list and points to the run log", () => {
    const failedPages = Array.from(
      { length: MAX_FAILED_PAGES_LISTED + 3 },
      (_, i) => `A: page ${i}: boom`,
    );
    const lines = renderSyncWarnings({
      generatedAt: "now",
      skippedCollections: [],
      failedPages,
    });
    expect(lines.filter((l) => l.startsWith("- A: page"))).toHaveLength(
      MAX_FAILED_PAGES_LISTED,
    );
    expect(lines).toContain("- …and 3 more, listed in the run log.");
  });
});
