import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  fetchReleaseDocs,
  type ReleaseDocsManifest,
} from "./fetch-release-docs";
import type { ReleaseDocSource } from "../config/collections";

const liveSource: ReleaseDocSource = {
  id: "live",
  name: "Live Component",
  repo: "pvarki/live",
  maxVersions: 2,
};

const deadSource: ReleaseDocSource = {
  id: "dead",
  name: "Dead Component",
  repo: "pvarki/dead",
};

// GitHub returns newest-first.
const releases = [
  // draft: skipped entirely
  {
    tag_name: "3.0.0",
    published_at: null,
    draft: true,
    prerelease: false,
    body: "draft",
  },
  {
    tag_name: "2.0.0",
    published_at: "2026-02-01T00:00:00Z",
    draft: false,
    prerelease: false,
    body: "## 2.0.0\n\n- a shiny new feature",
  },
  {
    tag_name: "1.0.0",
    published_at: "2026-01-01T00:00:00Z",
    draft: false,
    prerelease: false,
    body: "## 1.0.0\n\n- first release",
  },
  {
    // would exceed maxVersions: 2 — must not be written
    tag_name: "0.9.0",
    published_at: "2025-12-01T00:00:00Z",
    draft: false,
    prerelease: false,
    body: "## 0.9.0\n\n- old",
  },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}
function text(body: string, status = 200): Response {
  return new Response(body, { status });
}

const fakeFetch = (async (input: Parameters<typeof fetch>[0]) => {
  const url = String(input);
  if (
    url === "https://api.github.com/repos/pvarki/live/releases?per_page=100"
  ) {
    return json(releases);
  }
  if (
    url === "https://api.github.com/repos/pvarki/dead/releases?per_page=100"
  ) {
    return json({ message: "Not Found" }, 404);
  }
  if (
    url === "https://raw.githubusercontent.com/pvarki/live/main/CHANGELOG.md"
  ) {
    return text("# Changelog\n\n## 2.0.0\n\n- a shiny new feature\n");
  }
  if (
    url ===
    "https://raw.githubusercontent.com/pvarki/live/main/RELEASE_NOTES.md"
  ) {
    return text("not found", 404); // optional file absent -> degrades cleanly
  }
  if (url.startsWith("https://raw.githubusercontent.com/pvarki/dead/")) {
    return text("not found", 404);
  }
  throw new Error(`Unexpected fetch: ${url}`);
}) as typeof fetch;

describe("fetchReleaseDocs", () => {
  let outDir: string;
  let manifest: ReleaseDocsManifest;

  beforeAll(async () => {
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), "release-docs-"));
    manifest = await fetchReleaseDocs(
      [liveSource, deadSource],
      outDir,
      fakeFetch,
    );
  });

  afterAll(async () => {
    await fs.rm(outDir, { recursive: true, force: true });
  });

  it("renders release bodies newest-first, skipping drafts, capped at maxVersions", async () => {
    const live = manifest.components.find((c) => c.id === "live");
    expect(live?.releases.map((r) => r.tag)).toEqual(["2.0.0", "1.0.0"]);
    expect(live?.releases[0]).toMatchObject({
      file: "2.0.0.json",
      publishedAt: "2026-02-01T00:00:00Z",
    });
    const doc = JSON.parse(
      await fs.readFile(
        path.join(outDir, "live", "releases", "2.0.0.json"),
        "utf-8",
      ),
    );
    expect(doc.tag).toBe("2.0.0");
    expect(doc.html).toContain("shiny new feature");
    // beyond the cap is not written
    await expect(
      fs.access(path.join(outDir, "live", "releases", "0.9.0.json")),
    ).rejects.toThrow();
  });

  it("renders CHANGELOG.md and omits a missing RELEASE_NOTES.md", async () => {
    const live = manifest.components.find((c) => c.id === "live");
    expect(live?.changelogFile).toBe("changelog.json");
    expect(live?.releaseNotesFile).toBeUndefined();
    const changelog = JSON.parse(
      await fs.readFile(path.join(outDir, "live", "changelog.json"), "utf-8"),
    );
    expect(changelog.html).toContain("Changelog");
  });

  it("degrades a failing source to empty without throwing", () => {
    const dead = manifest.components.find((c) => c.id === "dead");
    expect(dead?.releases).toEqual([]);
    expect(dead?.changelogFile).toBeUndefined();
    expect(dead?.releaseNotesFile).toBeUndefined();
  });

  it("writes the manifest file", async () => {
    const onDisk = JSON.parse(
      await fs.readFile(path.join(outDir, "manifest.json"), "utf-8"),
    ) as ReleaseDocsManifest;
    expect(onDisk.components.map((c) => c.id)).toEqual(["live", "dead"]);
    expect(onDisk.generatedAt).toBeTruthy();
  });
});
