/**
 * Adds META markers to Outline organizer documents for all five guides.
 * Run with: pnpm tsx scripts/add-meta-markers.mts [--dry-run]
 *
 * What it does:
 * - Sets META: platforms-container on every "Platforms" organizer
 * - Sets META: platform / os / product on every platform child organizer
 * - Preserves any existing body content (appends if non-empty, sets if empty)
 */
import "dotenv/config";

const DRY_RUN = process.argv.includes("--dry-run");
const KEY = process.env.OUTLINE_API_KEY!;
const BASE = "https://pvarki.getoutline.com/api";

if (!KEY) throw new Error("OUTLINE_API_KEY not set");

async function post(path: string, body: object): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!data.ok && data.status !== 200) {
    throw new Error(`API error ${path}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function getDocText(id: string): Promise<string> {
  const data = await post("/documents.info", { id });
  return (data.data?.text ?? "") as string;
}

async function setDocMarkers(
  id: string,
  title: string,
  markers: string,
): Promise<void> {
  if (DRY_RUN) {
    console.log(
      `[dry-run] Would update [${id}] "${title}":\n  ${markers.replace(/\n/g, " | ")}`,
    );
    return;
  }
  const existing = await getDocText(id);
  // Strip any old META lines to avoid duplicates, then prepend fresh markers
  const withoutMeta = existing
    .split("\n")
    .filter(
      (l) => !l.match(/^META:\s*(platforms-container|platform:|os:|product:)/i),
    )
    .join("\n")
    .trimStart();
  // Each META: line must be its own paragraph (blank line between) so Outline's
  // Markdown renderer doesn't collapse them into a single line.
  const markerParagraphs = markers.split("\n").join("\n\n");
  const newText = withoutMeta
    ? `${markerParagraphs}\n\n${withoutMeta}`
    : markerParagraphs;
  await post("/documents.update", { id, text: newText, publish: true });
  console.log(`✓ Updated [${id}] "${title}"`);
}

// ---------------------------------------------------------------------------
// Document map: [id, title, markers]
// ---------------------------------------------------------------------------
const updates: Array<[id: string, title: string, markers: string]> = [
  // ── Deploy Guide ─────────────────────────────────────────────────────────
  // En
  [
    "105d6103-38c5-466b-aab3-08b645a37c43",
    "Platforms (Deploy/En)",
    "META: platforms-container",
  ],
  [
    "356a70b8-4ac4-470f-ae30-9a4249c7f989",
    "Android (Deploy/En)",
    "META: platform: android\nMETA: os: android",
  ],
  [
    "ee7d4162-9d19-4631-9d5e-b8a0181bdeaf",
    "iOS (Deploy/En)",
    "META: platform: ios\nMETA: os: ios",
  ],
  [
    "8e3fdeae-6802-4988-926f-474a171eeb67",
    "Windows (Deploy/En)",
    "META: platform: windows\nMETA: os: windows",
  ],
  [
    "64905c3d-3a72-4ab6-9d76-025444037001",
    "Linux (Deploy/En)",
    "META: platform: linux\nMETA: os: linux",
  ],
  [
    "408b4bff-52ff-4884-a66c-31a112d5546a",
    "MacOS (Deploy/En)",
    "META: platform: macos\nMETA: os: macos",
  ],
  // Fi
  [
    "9411626b-dd71-4966-aa36-8157622e055f",
    "Platforms (Deploy/Fi)",
    "META: platforms-container",
  ],
  [
    "cdd04071-30d1-41be-ae25-3b4b9e18d880",
    "Android (Deploy/Fi)",
    "META: platform: android\nMETA: os: android",
  ],
  // Sv
  [
    "0612a372-36bd-486b-9ca8-a589578ea2cc",
    "Platforms (Deploy/Sv)",
    "META: platforms-container",
  ],
  [
    "7778ee93-0a6a-4a0d-b4c0-0e611f9d5d24",
    "Android (Deploy/Sv)",
    "META: platform: android\nMETA: os: android",
  ],

  // ── TAK Guide ────────────────────────────────────────────────────────────
  // En
  [
    "1dce6fa1-0bff-48cf-86ab-531187b9dd3d",
    "Platforms (TAK/En)",
    "META: platforms-container",
  ],
  [
    "685f6f0f-e7ca-4ba3-807f-568582663e95",
    "ATAK (TAK/En)",
    "META: platform: atak\nMETA: os: android\nMETA: product: yes",
  ],
  [
    "2797bf1c-40d6-43ca-8f4c-9314097ee396",
    "WinTAK (TAK/En)",
    "META: platform: wintak\nMETA: os: windows\nMETA: product: yes",
  ],
  [
    "a976f932-3cba-4bf5-82ab-d91bcca94b98",
    "iTAK (TAK/En)",
    "META: platform: itak\nMETA: os: ios\nMETA: product: yes",
  ],
  [
    "8227a4a8-5540-4624-a24d-91a5037cf456",
    "TAK Tracker - Android (TAK/En)",
    "META: platform: tak-tracker-android\nMETA: os: android\nMETA: product: yes",
  ],
  [
    "2afa861e-7e13-4521-b433-48ab08d9a86f",
    "TAK Tracker - Apple (TAK/En)",
    "META: platform: tak-tracker-apple\nMETA: os: ios\nMETA: product: yes",
  ],
  // Fi (empty Platforms, no platform children yet)
  [
    "8caa7efe-4ea6-44eb-807e-fe7495defbfb",
    "Platforms (TAK/Fi)",
    "META: platforms-container",
  ],
  // Sv (empty Platforms, no platform children yet)
  [
    "8c943eff-7621-412d-ace3-021358ce30e7",
    "Platforms (TAK/Sv)",
    "META: platforms-container",
  ],

  // ── Matrix Guide ─────────────────────────────────────────────────────────
  // En
  [
    "de32139b-7ac9-435d-99e4-76fc37b41b8b",
    "Platforms (Matrix/En)",
    "META: platforms-container",
  ],
  // Fi
  [
    "4708aeef-6dc4-453e-9119-7ec98e99f24d",
    "Platforms (Matrix/Fi)",
    "META: platforms-container",
  ],
  // Sv
  [
    "b6280ed6-e647-4b1d-91ca-8196cbfd7d19",
    "Platforms (Matrix/Sv)",
    "META: platforms-container",
  ],

  // MTX Guide and CryptPad Guide have no Platforms wrappers — platform-agnostic
];

console.log(
  DRY_RUN
    ? `\nDRY RUN — ${updates.length} documents would be updated:\n`
    : `\nUpdating ${updates.length} organizer documents…\n`,
);

for (const [id, title, markers] of updates) {
  await setDocMarkers(id, title, markers);
}

console.log(
  DRY_RUN
    ? "\nDone (dry run — no changes made)"
    : `\nAll done. Run 'pnpm sync:outline' to pull changes into the app.`,
);
