#!/usr/bin/env tsx

/**
 * One-off (2026-06-14): give the TAK Guide → "Overview" page (the OpenDefence
 * Standard Model slideset) a diagram per slide.
 *
 * The page (https://pvarki.getoutline.com/doc/overview-CVNzKhRcKY) had no
 * pictures — just text slides describing who Sends/Gets what across GeoChat
 * channels (COMMAND/RECON/BLUFOR/COMMON) and Feeds (OBSERVATIONS/RECON/PLAN/
 * BLUFOR/SHARE). We author one Mermaid sequence diagram per slide (a master
 * overview + the four per-role views), render them to PNG with a headless
 * Chromium (mermaid dark theme on the site's #222 card colour; people-roles as
 * actors, systems/feeds as participants), and embed them as the slide pictures.
 *
 * While here we also CONVERT the doc from the legacy ```markdown fenced
 * slideset to the canonical `META: slides` format (per docs/authoring — convert
 * when you touch one).
 *
 * Update: the slideset was then expanded into the full "Usage Model" guide —
 * captions are drawn from the older rasenmaeher-ui materials
 * (src/assets/locale/en.json: serviceTakUsageFlowCard / ...ByFighterCard /
 * ...AtCPCard / takUsageWin3), WinTAK-specific wording dropped, plus a final
 * text-only slide for the command post's continuous tasks.
 *
 * Rendering: a tiny same-origin static server over mermaid's dist/ so the ESM
 * build and its lazy diagram chunks load normally in the browser (the UMD
 * mermaid.min.js is an esbuild IIFE that doesn't expose a clean global).
 *
 * Usage:
 *   pnpm tsx scripts/oneoff/2026-06-14-tak-overview-mermaid.ts            # render PNGs + print proposed body (no Outline writes)
 *   pnpm tsx scripts/oneoff/2026-06-14-tak-overview-mermaid.ts --apply    # render + upload attachments + update the (live) doc
 *
 * Output PNGs/sources: drafts/tak-overview-diagrams/
 */
import "dotenv/config";

import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";

import { chromium } from "@playwright/test";

import { createOutlineClient } from "../lib/outline-api";

// Minimal types for the browser-side globals used inside page.evaluate(). The
// scripts tsconfig has Node globals but not the DOM lib, and pulling DOM in
// would clash with @types/node's fetch/FormData/Blob — so we type just the bits
// we touch and cast globalThis to them (types are erased; nothing is shipped).
type MermaidLike = {
  initialize(config: Record<string, unknown>): void;
  render(id: string, code: string): Promise<{ svg: string }>;
};
type SvgLite = {
  viewBox: { baseVal: { width: number; height: number } };
  style: { maxWidth: string };
  setAttribute(name: string, value: string): void;
};
type BrowserGlobals = {
  __ready?: boolean;
  __mermaid: MermaidLike;
  document: {
    getElementById(
      id: string,
    ): { innerHTML: string; querySelector(sel: string): SvgLite | null } | null;
  };
};

const APPLY = process.argv.includes("--apply");
const DOC_ID = "0e075790-c86e-4330-9e1f-3d43298c5fce"; // TAK Guide → Overview (en)
const OUT_DIR = path.join(process.cwd(), "drafts/tak-overview-diagrams");

interface Diagram {
  /** Output file slug (NN-name). */
  file: string;
  /** Alt text / image caption used in the doc. */
  alt: string;
  code: string;
}

// Sequence diagrams modelled on the official rasenmaeher-ui takusageflow.svg:
// the core flow is Fighters → send markers to HQ (CP) → CP produces the feeds
// → Fighters receive them (read-only). Messaging is kept app-agnostic
// ("GeoChat / Matrix") since TAK is not the only chat option. The master
// reproduces the marker lifecycle; the per-role views are consistent with it.
// Per-slide captions below the images carry the numbered detail verbatim.
const DIAGRAMS: Diagram[] = [
  {
    file: "01-standard-model",
    alt: "OpenDefence Standard Model — a marker's lifecycle from observation to recon feed",
    code: `sequenceDiagram
    actor F as Fighters
    actor OB as Observer
    participant RF as RECON Feed
    participant CP as CP (HQ role)
    OB->>OB: 0. Make an observation
    Note over RF,CP: Marked as an Unknown Symbol with description
    OB->>CP: 1. Send symbol to HQ
    Note over CP: Users with the HQ role receive it
    CP->>CP: 2. Add interpretation to symbol
    CP->>RF: 3. Send symbol to the Feed
    Note over F,CP: All users can read the read-only RECON Feed
    RF->>F: 4. Fighters see the symbol in the recon feed
    CP->>CP: (5. Edit or remove the symbol)
    Note over F,CP: Symbol automatically updated for all`,
  },
  {
    file: "02-fighter-sends",
    alt: "Fighter sends — a marker to the HQ role, plus chat and observations",
    code: `sequenceDiagram
    actor F as Fighters
    participant M as Messaging (GeoChat / Matrix)
    participant OF as OBSERVATIONS Feed
    participant CP as CP (HQ role)
    F->>CP: Send marker to HQ role
    F->>M: 1. Chat on COMMAND, RECON,<br/>BLUFOR & COMMON
    F->>OF: 2. Recon observations<br/>(if applicable)
    Note over CP: HQ interprets the marker &<br/>produces the curated feeds`,
  },
  {
    file: "03-fighter-gets",
    alt: "Fighter gets — the read-only RECON, PLAN and BLUFOR feeds produced by HQ",
    code: `sequenceDiagram
    participant CP as CP (HQ role)
    participant RF as RECON Feed
    participant PF as PLAN Feeds
    participant BF as BLUFOR Feed
    actor F as Fighters
    Note over CP,BF: Produced by HQ / CP
    RF->>F: 4. what we know of the AO
    PF->>F: 5. marching & patrol routes,<br/>geofence alerts
    BF->>F: 6. approach routes to<br/>friendly positions
    Note over F,BF: Feeds are read-only for Fighters`,
  },
  {
    file: "04-leaders-cp-receive",
    alt: "Leaders & CP receive — markers from fighters, reports via messaging, SHARE/OBSERVATIONS feeds, upper echelons",
    code: `sequenceDiagram
    actor F as Fighters
    participant M as Messaging (GeoChat / Matrix)
    participant OF as SHARE & OBSERVATIONS
    participant U as Upper echelons
    participant CP as CP (HQ role)
    F->>CP: Fighters send markers to HQ role
    M->>CP: 1. reports reach HQ (COMMAND, RECON,<br/>BLUFOR & COMMON)
    OF->>CP: 2. SHARE & OBSERVATION posts<br/>(help build RECON)
    U->>CP: 3. plans, feeds & chat
    Note over CP: HQ builds the RECON picture`,
  },
  {
    file: "05-leaders-cp-send",
    alt: "Leaders & CP send — orders via messaging, and the RECON/PLAN/BLUFOR feeds Fighters receive",
    code: `sequenceDiagram
    actor CP as CP (HQ role)
    participant M as Messaging (GeoChat / Matrix)
    participant RF as RECON Feed
    participant PF as PLAN Feeds
    participant BF as BLUFOR Feed
    CP->>M: 4. order & gain information
    CP->>RF: 5. build — our knowledge of the AO
    CP->>PF: 6. create — describe operations
    CP->>BF: 7. approach routes & activities
    Note over RF,BF: Fighters then receive these feeds`,
  },
];

// The Usage Model guide slides. `diagram` references a DIAGRAMS file slug (the
// rendered mermaid used as that slide's picture); a slide with no `diagram` is
// text-only. Captions are drawn from the older rasenmaeher-ui materials
// (src/assets/locale/en.json): serviceTakUsageFlowCard (flow),
// serviceTakUsageByFighterCard (fighter), serviceTakUsageAtCPCard +
// takUsageWin3 (command post) — WinTAK-specific wording dropped.
const SLIDES: { title: string; caption: string; diagram?: string }[] = [
  {
    title: "OpenDefence Standard Model",
    diagram: "01-standard-model",
    caption: `- There are many ways to use TAK; we offer a well-thought usage model that delivers value without complexity.
- **Observation data flow:** a fighter observes something reportable, informs their own group, and sends a marker to the **HQ role** (the command post). The command post verifies and interprets it, then publishes it to the **Recon Feed** — which every user is subscribed to.
- **Goal:** the whole unit is aware of essential events within minutes of the observation.`,
  },
  {
    title: "Using TAK as a Fighter",
    diagram: "02-fighter-sends",
    caption: `1. When you make an observation, create a marker and **send it to the HQ role**.
2. Report as ordered — besides the marker, make the observation known via other mediums as you've been told to.`,
  },
  {
    title: "Follow the Recon Feed",
    diagram: "03-fighter-gets",
    caption: `3. Follow the **Recon Feed** — your command post (HQ) creates and updates it for your unit.
4. It holds the interpreted intelligence situation picture of your unit's observations, including yours.`,
  },
  {
    title: "Being a Command Post user",
    diagram: "04-leaders-cp-receive",
    caption: `1. TAK collects information from the force and distributes it back to them.
2. As a command post you create the unit's **Feeds** and use the **HQ** team role to receive and interpret fighters' observations.
3. To interpret: confirm the observation with its sender, draw conclusions if possible, then add confirmed observations to the **Recon Feed**.`,
  },
  {
    title: "Maintain the Recon Feed",
    diagram: "05-leaders-cp-send",
    caption: `4. Maintain the **Recon Feed**: send markers to it, update their information, and remove them when the information or situation changes.
- The command post produces and curates the unit's feeds — **RECON**, **PLAN** and **BLUFOR**.`,
  },
  {
    title: "Command Post — continuous tasks",
    caption: `The command post continuously, among other things:
1. **Knows** the force's mission and execution phase, to squad and team precision.
2. **Receives** immediately reportable matters from the force.
3. **Receives** periodic, formatted situation reports.
4. **Maintains** a message journal of all notifications received by any means.
5. **Maintains** a numbered intelligence diary (own forces, neighbours, higher echelons, enemy information).
6. **Maintains** information systems — TAK is one of them.

These six are information sources: actively seek and inquire. Your task is situational awareness — what is happening **now**, in **6 hours**, and in **24 hours**. TAK is just one tool; use it to collect and share information, creating information superiority for the force.`,
  },
];

/** Alt text for a diagram, by its file slug. */
const ALT_BY_FILE: Record<string, string> = Object.fromEntries(
  DIAGRAMS.map((d) => [d.file, d.alt]),
);

/** Locate mermaid's dist/ directory regardless of the pnpm hash. */
function mermaidDist(): string {
  const require = createRequire(import.meta.url);
  try {
    return path.join(
      path.dirname(require.resolve("mermaid/package.json")),
      "dist",
    );
  } catch {
    // Fallback: package.json not exposed via "exports".
    return path.join(
      process.cwd(),
      "node_modules/.pnpm/mermaid@11.15.0/node_modules/mermaid/dist",
    );
  }
}

const PAGE_HTML = `<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#222222;}
  #wrap{display:inline-block;padding:28px 32px;background:#222222;}
  #c svg{display:block;max-width:none!important;height:auto;}
</style></head>
<body><div id="wrap"><div id="c"></div></div>
<script type="module">
  import mermaid from "/mermaid.esm.min.mjs";
  window.__mermaid = mermaid;
  window.__ready = true;
</script></body></html>`;

function contentType(p: string): string {
  if (p.endsWith(".mjs") || p.endsWith(".js"))
    return "text/javascript; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

async function renderAll(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const DIST = mermaidDist();

  const server = http.createServer(async (req, res) => {
    try {
      const url = (req.url || "/").split("?")[0];
      if (url === "/") {
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.end(PAGE_HTML);
        return;
      }
      const filePath = path.join(DIST, path.normalize(url));
      if (!filePath.startsWith(DIST)) {
        res.statusCode = 403;
        res.end("forbidden");
        return;
      }
      const buf = await readFile(filePath);
      res.setHeader("content-type", contentType(filePath));
      res.end(buf);
    } catch {
      res.statusCode = 404;
      res.end("not found");
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") console.warn("  [browser]", m.text());
  });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(
    () => (globalThis as unknown as BrowserGlobals).__ready === true,
    { timeout: 30_000 },
  );

  for (const d of DIAGRAMS) {
    const svg = await page.evaluate(
      async ({ code, id }: { code: string; id: string }) => {
        const m = (globalThis as unknown as BrowserGlobals).__mermaid;
        // Match the official takusageflow.svg: mermaid's built-in dark theme
        // (near-black actor boxes, #81B1DB blue borders, light-grey messages,
        // dark notes, mirrored actors) in trebuchet, on the app's #222 card.
        m.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          fontFamily: '"trebuchet ms", verdana, arial, sans-serif',
          sequence: {
            useMaxWidth: false,
            mirrorActors: true,
            actorFontSize: 16,
            messageFontSize: 15,
            noteFontSize: 14,
            boxMargin: 10,
          },
          themeVariables: {
            fontSize: "16px",
            actorBorder: "#81B1DB",
            actorLineColor: "#81B1DB",
          },
        });
        const { svg } = await m.render(id, code);
        return svg;
      },
      { code: d.code, id: "mmd-" + d.file },
    );

    await page.evaluate((html: string) => {
      const doc = (globalThis as unknown as BrowserGlobals).document;
      const c = doc.getElementById("c")!;
      c.innerHTML = html;
      // mermaid emits width="100%" + max-width, which collapses to the 300px
      // default replaced-element width. Pin the SVG to its natural viewBox size
      // so the screenshot is full resolution, not squished.
      const el = c.querySelector("svg")!;
      const vb = el.viewBox.baseVal;
      el.style.maxWidth = "none";
      el.setAttribute("width", String(Math.ceil(vb.width)));
      el.setAttribute("height", String(Math.ceil(vb.height)));
    }, svg);
    await page.waitForTimeout(120);

    const out = path.join(OUT_DIR, `${d.file}.png`);
    await page.locator("#wrap").screenshot({ path: out });
    await writeFile(path.join(OUT_DIR, `${d.file}.mmd`), d.code + "\n");
    const box = await page.locator("#wrap svg").boundingBox();
    console.log(
      `  rendered ${d.file}.png  (${Math.round(box?.width ?? 0)}×${Math.round(box?.height ?? 0)} css px)`,
    );
  }

  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
}

/** Build the canonical `META: slides` body. urlByFile maps a diagram slug to
 * its hosted attachment URL; a slide without a `diagram` renders text-only. */
function buildBody(urlByFile: Record<string, string>): string {
  const steps = SLIDES.map((s) => {
    const url = s.diagram ? urlByFile[s.diagram] : undefined;
    const img = url ? `![${ALT_BY_FILE[s.diagram!]}](${url})\n\n` : "";
    return `## ${s.title}\n\n${img}${s.caption}`;
  }).join("\n\n");
  return `(This tab should not be shown)\n\nMETA: slides\n\n${steps}\n`;
}

async function main(): Promise<void> {
  console.log(
    `Rendering ${DIAGRAMS.length} diagrams → ${path.relative(process.cwd(), OUT_DIR)}/`,
  );
  await renderAll();

  if (!APPLY) {
    console.log(
      "\n--- DRY RUN: proposed canonical body (image URLs are placeholders) ---\n",
    );
    const placeholders = Object.fromEntries(
      DIAGRAMS.map((d) => [d.file, `<${d.file}>`]),
    );
    console.log(buildBody(placeholders));
    console.log(
      "\n(no Outline writes — re-run with --apply to upload + update the doc)",
    );
    return;
  }

  const client = createOutlineClient();
  console.log("\nUploading attachments to Outline…");
  const urlByFile: Record<string, string> = {};
  for (const d of DIAGRAMS) {
    const { url } = await client.uploadAttachment(
      path.join(OUT_DIR, `${d.file}.png`),
      {
        name: `${d.file}.png`,
        documentId: DOC_ID,
      },
    );
    console.log(`  uploaded ${d.file}.png → ${url}`);
    urlByFile[d.file] = url;
  }

  const body = buildBody(urlByFile);
  console.log("\nUpdating document (kept at current publish state)…");
  await client.updateDocument(DOC_ID, body);
  console.log(
    "✓ Done. Review in Outline, then run `pnpm sync` to pull it into the app.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
