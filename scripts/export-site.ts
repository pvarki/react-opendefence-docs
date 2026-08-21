/**
 * Zip the static build (dist/) for hosting on an intranet web server.
 *
 *   pnpm export:site        # runs pnpm build first, then zips
 *
 * Output: exports/site-snapshot.zip — dist/ plus an IIS web.config (SPA
 * fallback rewrite) and a README.txt with serving requirements. Note this is
 * for a real web server: SharePoint 2013 document libraries force-download
 * HTML files instead of rendering them, so the snapshot cannot live there.
 * The zip is large (~200 MB): it carries every locale's screenshots.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import AdmZip from "adm-zip";

import { ensureDir } from "./lib/utils";

const DIST = path.join(process.cwd(), "dist");
const OUT = path.join(process.cwd(), "exports", "site-snapshot.zip");

const WEB_CONFIG = `<?xml version="1.0" encoding="UTF-8"?>
<!-- IIS: serve the docs SPA — rewrite unknown paths to index.html. -->
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="SPA fallback" stopProcessing="true">
          <match url=".*" />
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <remove fileExtension=".webp" />
      <mimeMap fileExtension=".webp" mimeType="image/webp" />
      <remove fileExtension=".json" />
      <mimeMap fileExtension=".json" mimeType="application/json" />
      <remove fileExtension=".webmanifest" />
      <mimeMap fileExtension=".webmanifest" mimeType="application/manifest+json" />
    </staticContent>
  </system.webServer>
</configuration>
`;

const README = `docs.opendefence.fi — static site snapshot
===========================================

This folder is the complete docs site as static files. To serve it:

1. Host it at the ROOT of a web site (its own port or subdomain) — the app
   uses absolute paths like /content/..., so a sub-folder URL will not work.
2. The server must send unknown paths to index.html (SPA fallback). For IIS,
   the included web.config does this (requires the URL Rewrite module). The
   included 404.html covers GitHub-Pages-style hosts.
3. This CANNOT be hosted inside a SharePoint document library: SharePoint
   2013 force-downloads HTML files instead of rendering them. Use the
   per-topic PowerPoint exports (pnpm export:pptx) for SharePoint instead.

Regenerate this snapshot any time with: pnpm export:site
`;

function main() {
  const indexPath = path.join(DIST, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error(
      "dist/index.html missing — run via `pnpm export:site` (it builds first)",
    );
    process.exit(1);
  }

  // Zipping a stale build silently ships month-old docs to the intranet —
  // compare against the synced content (manifest is rewritten by every sync).
  const builtAt = fs.statSync(indexPath).mtime;
  const manifestPath = path.join(
    process.cwd(),
    "public",
    "content",
    "en",
    "manifest.json",
  );
  if (
    fs.existsSync(manifestPath) &&
    fs.statSync(manifestPath).mtime > builtAt
  ) {
    console.warn(
      `[export-site] WARNING: dist/ (built ${builtAt.toISOString().slice(0, 16)}) is OLDER than the synced content — run \`pnpm export:site\` so it rebuilds first`,
    );
  }
  console.log(
    `[export-site] zipping dist/ built ${builtAt.toISOString().slice(0, 16)}`,
  );

  const zip = new AdmZip();
  zip.addLocalFolder(DIST);
  zip.addFile("web.config", Buffer.from(WEB_CONFIG, "utf8"));
  zip.addFile("README.txt", Buffer.from(README, "utf8"));

  ensureDir(path.dirname(OUT));
  zip.writeZip(OUT);

  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
  console.log(
    `[export-site] wrote ${path.relative(process.cwd(), OUT)} (${mb} MB)`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
