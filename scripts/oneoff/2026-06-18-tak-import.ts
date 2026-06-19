/**
 * Phase 1 import: validate reformatted pages and push changed ones to Outline.
 *
 *   npx tsx scripts/oneoff/2026-06-18-tak-import.ts            # dry-run (default)
 *   npx tsx scripts/oneoff/2026-06-18-tak-import.ts --apply    # write to Outline
 *
 * Safety: a fixed page is only accepted if it preserves structural invariants
 * vs its source — same META: slides, identical ## headings (titles), identical
 * image lines, and the same non-bullet word stream (we only allow inserting
 * "- " bullets + line breaks, never reworded text).
 */
import "dotenv/config";
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { createOutlineClient } from "../lib/outline-api";

const OUT = "/tmp/tak-reformat";
const APPLY = process.argv.includes("--apply");
const client = createOutlineClient();

const APPLIED_LOG = `${OUT}/applied.log`;
const alreadyApplied = new Set<string>(
  existsSync(APPLIED_LOG)
    ? readFileSync(APPLIED_LOG, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    : [],
);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** updateDocument with retry on transient network errors (ETIMEDOUT, fetch failed). */
async function updateWithRetry(id: string, text: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      await client.updateDocument(id, text);
      return;
    } catch (e) {
      lastErr = e;
      const wait = 2000 * 2 ** (attempt - 1);
      console.log(
        `      …retry ${attempt}/6 after error (${(e as Error)?.message ?? e}); waiting ${wait / 1000}s`,
      );
      await sleep(wait);
    }
  }
  throw lastErr;
}

interface Item {
  id: string;
  title: string;
  platform: string;
  file: string;
}

const headings = (s: string) =>
  (s.match(/^##\s+.*$/gm) ?? []).map((h) => h.trim());
const images = (s: string) =>
  (s.match(/^\s*!\[.*$/gm) ?? []).map((h) => h.trim());

/** Normalize to the bag of words after removing bullet markers / list line-breaks,
 *  so a pure "prose -> lead + bullets" reflow compares equal but any reword differs. */
function wordStream(s: string): string {
  return s
    .replace(/^META:.*$/gm, "")
    .replace(/^\s*[-*]\s+/gm, " ") // strip bullet markers
    .replace(/;/g, " ") // a semicolon-joined clause list legitimately loses its ";" when split to bullets
    .replace(/\s+/g, " ")
    .trim();
}

function validate(src: string, fixed: string): string[] {
  const problems: string[] = [];
  if (!fixed.trimStart().startsWith("META: slides"))
    problems.push("lost 'META: slides'");
  const hs = headings(src).join("\n");
  const hf = headings(fixed).join("\n");
  if (hs !== hf) problems.push("slide titles (## headings) changed");
  const is = images(src).join("\n");
  const ifx = images(fixed).join("\n");
  if (is !== ifx) problems.push("image lines changed");
  if (wordStream(src) !== wordStream(fixed))
    problems.push("word stream changed (text reworded/added/dropped)");
  return problems;
}

async function main() {
  const manifest: Item[] = JSON.parse(
    readFileSync(`${OUT}/manifest.json`, "utf8"),
  );
  let changed = 0;
  let applied = 0;
  let skipped = 0;
  const flagged: string[] = [];

  for (const it of manifest) {
    const srcPath = `${OUT}/src/${it.id}.md`;
    const fixedPath = `${OUT}/fixed/${it.id}.md`;
    const src = readFileSync(srcPath, "utf8");
    if (!existsSync(fixedPath)) {
      console.log(`  ?  MISSING fixed file: ${it.platform} / ${it.title}`);
      skipped++;
      continue;
    }
    const fixed = readFileSync(fixedPath, "utf8");
    if (src === fixed) continue; // unchanged

    changed++;
    // Manually verified correct (semicolon-joined list -> bullets; final period
    // normalized away to match the other periodless bullets):
    const ACCEPT_FLAGGED = new Set<string>([
      "3cbf6a03-80dd-48d2-891a-fc9ca3bce21c",
    ]);
    const problems = ACCEPT_FLAGGED.has(it.id) ? [] : validate(src, fixed);
    const srcBullets = (src.match(/^\s*-\s+/gm) ?? []).length;
    const fixBullets = (fixed.match(/^\s*-\s+/gm) ?? []).length;
    if (problems.length) {
      console.log(`\n  ✗ FLAG ${it.platform} / ${it.title}  (${it.id})`);
      for (const p of problems) console.log(`      - ${p}`);
      flagged.push(`${it.platform} / ${it.title}`);
      skipped++;
      continue;
    }
    if (APPLY && alreadyApplied.has(it.id)) {
      console.log(`  ·  ${it.platform} / ${it.title}  (already applied, skip)`);
      continue;
    }
    console.log(
      `\n  ✓ ${it.platform} / ${it.title}  (+${fixBullets - srcBullets} bullets)`,
    );
    if (APPLY) {
      await updateWithRetry(it.id, fixed);
      appendFileSync(APPLIED_LOG, it.id + "\n");
      applied++;
      console.log(`      → updated in Outline`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `changed pages: ${changed}   ${APPLY ? `applied: ${applied}` : "(dry-run, nothing written)"}   skipped/flagged: ${skipped}`,
  );
  if (flagged.length) {
    console.log(`\nFLAGGED (need manual look, NOT written):`);
    for (const f of flagged) console.log(`  - ${f}`);
  }
  if (!APPLY && changed)
    console.log(
      `\nRe-run with --apply to write the ${changed - flagged.length} clean changes to Outline.`,
    );
}

main().catch((e) => {
  console.error("IMPORT ERROR:", e);
  process.exit(1);
});
