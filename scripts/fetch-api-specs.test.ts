import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { fetchApiSpecs, type ApiSpecsManifest } from "./fetch-api-specs";
import type { ApiSpecSource } from "../config/collections";

const ghPagesSource: ApiSpecSource = {
  id: "core",
  name: "Core API",
  kind: "gh-pages",
  url: "https://example.com/openapi.json",
  overlay: {
    title: "Branded Core API",
    description: "Overview text.",
    servers: [
      { url: "https://{host}.example.com", description: "Per deploy." },
    ],
  },
};

const releaseSource: ApiSpecSource = {
  id: "rel",
  name: "Release API",
  kind: "release-assets",
  repo: "org/repo",
  assetPath: "openapi.json",
  maxVersions: 2,
};

const deadSource: ApiSpecSource = {
  id: "dead",
  name: "Dead API",
  kind: "gh-pages",
  url: "https://example.com/404.json",
};

const releases = [
  // draft: skipped entirely
  {
    tag_name: "v3.0.0",
    published_at: null,
    draft: true,
    prerelease: false,
    assets: [],
  },
  {
    tag_name: "v2.0.0",
    published_at: "2026-02-01T00:00:00Z",
    draft: false,
    prerelease: false,
    assets: [
      {
        name: "openapi.json",
        browser_download_url: "https://dl.example/v2/openapi.json",
      },
    ],
  },
  {
    tag_name: "v1.0.0",
    published_at: "2026-01-01T00:00:00Z",
    draft: false,
    prerelease: false,
    assets: [
      {
        name: "openapi.json",
        browser_download_url: "https://dl.example/v1/openapi.json",
      },
    ],
  },
  {
    // would exceed maxVersions: 2 — must not be downloaded
    tag_name: "v0.9.0",
    published_at: "2025-12-01T00:00:00Z",
    draft: false,
    prerelease: false,
    assets: [
      {
        name: "openapi.json",
        browser_download_url: "https://dl.example/v0/openapi.json",
      },
    ],
  },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const fakeFetch = (async (input: Parameters<typeof fetch>[0]) => {
  const url = String(input);
  if (url === "https://example.com/openapi.json") {
    return json({ openapi: "3.0.0", "x-generated-date": "2026-03-01" });
  }
  if (url === "https://example.com/404.json") {
    return json({ error: "nope" }, 404);
  }
  if (url === "https://api.github.com/repos/org/repo/releases?per_page=100") {
    return json(releases);
  }
  if (url.startsWith("https://dl.example/")) {
    return json({ openapi: "3.0.0", source: url });
  }
  throw new Error(`Unexpected fetch: ${url}`);
}) as typeof fetch;

describe("fetchApiSpecs", () => {
  let outDir: string;
  let manifest: ApiSpecsManifest;

  beforeAll(async () => {
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-specs-"));
    manifest = await fetchApiSpecs(
      [ghPagesSource, releaseSource, deadSource],
      outDir,
      fakeFetch,
    );
  });

  afterAll(async () => {
    await fs.rm(outDir, { recursive: true, force: true });
  });

  it("writes gh-pages specs as latest.json with publishedAt from the spec", async () => {
    const core = manifest.sources.find((s) => s.id === "core");
    expect(core?.versions).toEqual([
      { tag: "latest", specFile: "latest.json", publishedAt: "2026-03-01" },
    ]);
    const spec = JSON.parse(
      await fs.readFile(path.join(outDir, "core", "latest.json"), "utf-8"),
    );
    expect(spec.openapi).toBe("3.0.0");
  });

  it("applies the source overlay (title/description/servers) to the written spec", async () => {
    const spec = JSON.parse(
      await fs.readFile(path.join(outDir, "core", "latest.json"), "utf-8"),
    );
    // Upstream spec had no info block — overlay must create it.
    expect(spec.info).toMatchObject({
      title: "Branded Core API",
      description: "Overview text.",
    });
    expect(spec.servers).toEqual([
      { url: "https://{host}.example.com", description: "Per deploy." },
    ]);
  });

  it("downloads release assets newest-first, skipping drafts, capped at maxVersions", async () => {
    const rel = manifest.sources.find((s) => s.id === "rel");
    expect(rel?.versions.map((v) => v.tag)).toEqual(["v2.0.0", "v1.0.0"]);
    expect(rel?.versions[0]).toMatchObject({
      specFile: "v2.0.0.json",
      publishedAt: "2026-02-01T00:00:00Z",
    });
    await expect(
      fs.access(path.join(outDir, "rel", "v2.0.0.json")),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(outDir, "rel", "v0.9.0.json")),
    ).rejects.toThrow();
  });

  it("degrades failing sources to empty versions without throwing", () => {
    const dead = manifest.sources.find((s) => s.id === "dead");
    expect(dead?.versions).toEqual([]);
  });

  it("writes the manifest file", async () => {
    const onDisk = JSON.parse(
      await fs.readFile(path.join(outDir, "manifest.json"), "utf-8"),
    ) as ApiSpecsManifest;
    expect(onDisk.sources.map((s) => s.id)).toEqual(["core", "rel", "dead"]);
    expect(onDisk.generatedAt).toBeTruthy();
  });
});
