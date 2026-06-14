#!/usr/bin/env tsx

/**
 * Scaffold a local guide draft folder in the canonical `META: slides` format.
 *
 *   pnpm author:scaffold <product> <platform> <slug> <stepCount> [--title "..."] [--force]
 *
 * Examples:
 *   pnpm author:scaffold deploy-app android install-deploy-app 5
 *   pnpm author:scaffold matrix _ join-a-room 4 --title "Join a room"
 *
 * Use "_" for the platform of a platform-agnostic book (e.g. Matrix). Creates:
 *
 *   drafts/<product>/<platform>/<slug>/
 *     guide.md      ← the canonical markdown you (or I) fill in, one ## per step
 *     hints.txt     ← one line per screenshot; never published, just authoring notes
 *
 * Then: drop screenshots in as 01-screenshot.png, 02-screenshot.png, … and run
 *   pnpm author:push drafts/<product>/<platform>/<slug>
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getPlatform, getProduct } from "./products";

const args = process.argv.slice(2);
const force = args.includes("--force");
const titleFlagIdx = args.indexOf("--title");
const titleFlag = titleFlagIdx >= 0 ? args[titleFlagIdx + 1] : undefined;
const titleValueIdx = titleFlagIdx >= 0 ? titleFlagIdx + 1 : -1;
const positional = args.filter(
  (a, i) => !a.startsWith("--") && i !== titleValueIdx,
);

const [productKey, platformKey, slug, stepCountRaw] = positional;
if (!productKey || !platformKey || !slug || !stepCountRaw) {
  console.error(
    'Usage: pnpm author:scaffold <product> <platform> <slug> <stepCount> [--title "..."] [--force]',
  );
  process.exit(1);
}

const stepCount = Number(stepCountRaw);
if (!Number.isInteger(stepCount) || stepCount < 1) {
  console.error(`stepCount must be a positive integer, got "${stepCountRaw}"`);
  process.exit(1);
}

// Validate the target exists (so typos fail here, not at push time).
const product = getProduct(productKey);
if (platformKey !== "_") {
  getPlatform(product, platformKey);
} else if (product.platforms.length > 0) {
  console.error(
    `"${productKey}" is platform-aware; pass one of: ${product.platforms
      .map((p) => p.key)
      .join(", ")}`,
  );
  process.exit(1);
}

const titleCase = (s: string) =>
  s
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
const title = titleFlag ?? titleCase(slug);

const pad = (n: number) => String(n).padStart(2, "0");

const steps = Array.from({ length: stepCount }, (_, i) => {
  const n = pad(i + 1);
  return [
    `## Step ${i + 1} — <short action title>`,
    "",
    `![<describe the screenshot>](./${n}-screenshot.png)`,
    "",
    "<What the reader does here. Name exact button labels and any non-obvious bit.>",
  ].join("\n");
}).join("\n\n");

const guideMd = `# ${title}

META: slides

<One or two sentences: what this guide accomplishes and roughly how long it takes.>

${steps}
`;

const hints = `# Authoring notes — NOT published. One line per screenshot.
# Format:  NN: what's happening / exact button labels / non-obvious step
${Array.from({ length: stepCount }, (_, i) => `${pad(i + 1)}: `).join("\n")}
`;

const dir = join(process.cwd(), "drafts", productKey, platformKey, slug);
const guidePath = join(dir, "guide.md");

if (existsSync(guidePath) && !force) {
  console.error(`Refusing to overwrite ${guidePath} (pass --force).`);
  process.exit(1);
}

mkdirSync(dir, { recursive: true });
writeFileSync(guidePath, guideMd);
const hintsPath = join(dir, "hints.txt");
if (!existsSync(hintsPath) || force) writeFileSync(hintsPath, hints);

console.log(`✓ Scaffolded ${stepCount}-step draft:`);
console.log(`  ${guidePath}`);
console.log(`  ${hintsPath}`);
console.log(
  `\nNext: drop screenshots as ${pad(1)}-screenshot.png … ${pad(
    stepCount,
  )}-screenshot.png in that folder, fill in captions, then:`,
);
console.log(`  pnpm author:push drafts/${productKey}/${platformKey}/${slug}`);
