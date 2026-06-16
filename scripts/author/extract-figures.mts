#!/usr/bin/env tsx

/**
 * Extract candidate figures from a source PDF page range into a draft's
 * `_candidates/` folder, so you can eyeball them and copy the right ones to
 * `NN-screenshot.png`. Used by the Claude→Outline authoring loop when a chapter
 * has no branded screenshot and we fall back to the official manual's figures.
 *
 *   pnpm author:figures "<pdf>" <pages> <outDir> [--min 180]
 *
 * Examples:
 *   pnpm author:figures \
 *     "helpcontent/takcontent/atakcontent/ATAK_User_Guide_570.pdf" \
 *     32-34 drafts/tak/atak/downloading-maps-for-offline-use/_candidates
 *
 * <pages> is "N" or "N-M". Embedded raster images are pulled per page with
 * `pdfimages -png`; anything narrower than --min px (default 180) is dropped as
 * an icon. Files are named pNN-iMM.png and a manifest is printed (size + path).
 * Needs poppler's pdfimages and macOS `sips` on PATH.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const minIdx = args.indexOf("--min");
const minWidth = minIdx >= 0 ? Number(args[minIdx + 1]) : 180;
const positional = args.filter(
  (a, i) => !a.startsWith("--") && i !== (minIdx >= 0 ? minIdx + 1 : -1),
);
const [pdfArg, pagesArg, outArg] = positional;

if (!pdfArg || !pagesArg || !outArg) {
  console.error(
    'Usage: pnpm author:figures "<pdf>" <pages> <outDir> [--min 180]',
  );
  process.exit(1);
}

const pdf = resolve(process.cwd(), pdfArg);
if (!existsSync(pdf)) {
  console.error(`PDF not found: ${pdf}`);
  process.exit(1);
}

const m = pagesArg.match(/^(\d+)(?:-(\d+))?$/);
if (!m) {
  console.error(`Bad page range "${pagesArg}" — use N or N-M`);
  process.exit(1);
}
const first = Number(m[1]);
const last = m[2] ? Number(m[2]) : first;

const outDir = resolve(process.cwd(), outArg);
// Fresh candidates folder each run so stale extracts don't pile up.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const pad = (n: number) => String(n).padStart(2, "0");

function widthOf(file: string): number {
  try {
    const out = execFileSync("sips", ["-g", "pixelWidth", file], {
      encoding: "utf-8",
    });
    const wm = out.match(/pixelWidth:\s*(\d+)/);
    return wm ? Number(wm[1]) : 0;
  } catch {
    return 0;
  }
}
function dimsOf(file: string): string {
  try {
    const out = execFileSync(
      "sips",
      ["-g", "pixelWidth", "-g", "pixelHeight", file],
      { encoding: "utf-8" },
    );
    const w = out.match(/pixelWidth:\s*(\d+)/)?.[1] ?? "?";
    const h = out.match(/pixelHeight:\s*(\d+)/)?.[1] ?? "?";
    return `${w}x${h}`;
  } catch {
    return "?x?";
  }
}

const kept: Array<{ file: string; dims: string }> = [];
for (let p = first; p <= last; p++) {
  const prefix = join(outDir, `p${pad(p)}`);
  try {
    execFileSync(
      "pdfimages",
      ["-png", "-f", String(p), "-l", String(p), pdf, prefix],
      { stdio: "ignore" },
    );
  } catch {
    // page with no images, or pdfimages hiccup — skip
  }
  for (const name of readdirSync(outDir)) {
    const full = join(outDir, name);
    if (!name.startsWith(`p${pad(p)}-`) || !name.endsWith(".png")) continue;
    if (!statSync(full).isFile()) continue;
    if (widthOf(full) < minWidth) {
      unlinkSync(full); // drop icons / slivers
      continue;
    }
    if (!kept.some((k) => k.file === full)) {
      kept.push({ file: full, dims: dimsOf(full) });
    }
  }
}

kept.sort((a, b) => a.file.localeCompare(b.file));
console.log(
  `Extracted ${kept.length} candidate figure(s) (width ≥ ${minWidth}px) to ${outArg}:`,
);
for (const k of kept) {
  console.log(
    `  ${k.dims.padStart(10)}  ${k.file.replace(process.cwd() + "/", "")}`,
  );
}
console.log(
  `\nNext: view them, then copy the chosen ones to NN-screenshot.png in the draft folder.`,
);
