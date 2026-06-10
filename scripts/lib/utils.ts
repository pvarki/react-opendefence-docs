/**
 * Shared utilities for the sync pipeline scripts.
 *
 * Ported from the old wiki's scripts/lib/utils.ts + text-sanitizer.ts — only
 * the helpers the pipeline actually uses (sync-outline, sidebar-generator,
 * validate-docs call sites). The emoji patterns are byte-identical to the old
 * text-sanitizer; keep them in sync with the public stripEmojis export in
 * outline-normalizer.ts.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

// File System Utilities

/** Ensure a directory exists, creating it recursively if needed. */
export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/** Ensure a directory exists (async version). */
export async function ensureDirAsync(dirPath: string): Promise<void> {
  await fsp.mkdir(dirPath, { recursive: true });
}

/** Check if a file exists. */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/** Check if a file exists (async version). */
export async function fileExistsAsync(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Read file as UTF-8 text, returning null if not found. */
export async function readFileIfExists(
  filePath: string,
): Promise<string | null> {
  try {
    return await fsp.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/** Write file with directory creation. */
export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  await ensureDirAsync(path.dirname(filePath));
  await fsp.writeFile(filePath, content, "utf-8");
}

/**
 * Write a JSON file: 2-space indent, LF, trailing newline (repo convention
 * for everything under public/content/ — keeps git diffs and prettier quiet).
 */
export async function writeJsonFile(
  filePath: string,
  data: unknown,
  spaces = 2,
): Promise<void> {
  const content = JSON.stringify(data, null, spaces) + "\n";
  await writeFile(filePath, content);
}

/** Read and parse JSON file. */
export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  const content = await fsp.readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
}

// Path Utilities

/** Resolve path relative to the current working directory. */
export function resolvePath(...segments: string[]): string {
  return path.join(process.cwd(), ...segments);
}

/** Normalize path separators to forward slashes. */
export function normalizePath(pathStr: string): string {
  return pathStr.replace(/\\/g, "/");
}

// Timing Utilities

/** Format duration in milliseconds to human-readable string. */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(2)}s`;
}

/** Create a simple timer for measuring durations. */
export function createTimer(): {
  elapsed: () => number;
  format: () => string;
} {
  const start = Date.now();
  return {
    elapsed: () => Date.now() - start,
    format: () => formatDuration(Date.now() - start),
  };
}

/** Sleep for a specified duration. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Console Output Utilities

/** Print a section divider with title. */
export function printSection(title: string, char = "=", width = 60): void {
  console.log("\n" + char.repeat(width));
  console.log(title);
  console.log(char.repeat(width));
}

/** Print key-value pairs in a formatted list. */
export function printStats(
  items: Record<string, unknown>,
  indent = "  ",
): void {
  const maxKeyLength = Math.max(...Object.keys(items).map((k) => k.length));

  for (const [key, value] of Object.entries(items)) {
    const paddedKey = key.padEnd(maxKeyLength + 1);
    console.log(`${indent}${paddedKey}: ${value}`);
  }
}

/** Pluralize a word based on count. */
export function pluralize(
  count: number,
  singular: string,
  plural?: string,
): string {
  const word = count === 1 ? singular : plural || `${singular}s`;
  return `${count} ${word}`;
}

// Emoji Removal (internal)

/**
 * Comprehensive emoji regex patterns covering all major Unicode emoji ranges.
 * Byte-identical port of the old text-sanitizer EMOJI_PATTERNS. The public
 * stripEmojis export lives in outline-normalizer.ts (cross-track contract);
 * this private copy keeps the label/slug helpers below dependency-free.
 */
const EMOJI_PATTERNS = [
  // Emoji modifiers, variation selectors, ZWJ sequences
  /[\u{1F3FB}-\u{1F3FF}]/gu,
  /[\u{FE00}-\u{FE0F}]/gu,
  /\u{200D}/gu,

  // Main emoji blocks
  /[\u{1F600}-\u{1F64F}]/gu, // Emoticons
  /[\u{1F300}-\u{1F5FF}]/gu, // Misc Symbols and Pictographs
  /[\u{1F680}-\u{1F6FF}]/gu, // Transport and Map
  /[\u{1F1E0}-\u{1F1FF}]/gu, // Flags
  /[\u{2600}-\u{26FF}]/gu, // Misc symbols
  /[\u{2700}-\u{27BF}]/gu, // Dingbats
  /[\u{1F900}-\u{1F9FF}]/gu, // Supplemental Symbols and Pictographs
  /[\u{1FA00}-\u{1FA6F}]/gu, // Chess Symbols
  /[\u{1FA70}-\u{1FAFF}]/gu, // Symbols and Pictographs Extended-A

  // Additional symbol ranges commonly used as emoji
  /[\u{231A}-\u{231B}]/gu, // Watch, Hourglass
  /[\u{23E9}-\u{23F3}]/gu, // Various symbols
  /[\u{23F8}-\u{23FA}]/gu, // Various symbols
  /[\u{25AA}-\u{25AB}]/gu, // Squares
  /[\u{25B6}]/gu, // Play button
  /[\u{25C0}]/gu, // Reverse button
  /[\u{25FB}-\u{25FE}]/gu, // Squares
  /[\u{2614}-\u{2615}]/gu, // Umbrella, Hot Beverage
  /[\u{2648}-\u{2653}]/gu, // Zodiac
  /[\u{267F}]/gu, // Wheelchair
  /[\u{2693}]/gu, // Anchor
  /[\u{26A1}]/gu, // High Voltage
  /[\u{26AA}-\u{26AB}]/gu, // Circles
  /[\u{26BD}-\u{26BE}]/gu, // Soccer, Baseball
  /[\u{26C4}-\u{26C5}]/gu, // Snowman, Sun
  /[\u{26CE}]/gu, // Ophiuchus
  /[\u{26D4}]/gu, // No Entry
  /[\u{26EA}]/gu, // Church
  /[\u{26F2}-\u{26F3}]/gu, // Fountain, Golf
  /[\u{26F5}]/gu, // Sailboat
  /[\u{26FA}]/gu, // Tent
  /[\u{26FD}]/gu, // Fuel Pump
  /[\u{2702}]/gu, // Scissors
  /[\u{2705}]/gu, // Check Mark
  /[\u{2708}-\u{270D}]/gu, // Various
  /[\u{270F}]/gu, // Pencil
  /[\u{2712}]/gu, // Black Nib
  /[\u{2714}]/gu, // Check Mark
  /[\u{2716}]/gu, // X Mark
  /[\u{271D}]/gu, // Latin Cross
  /[\u{2721}]/gu, // Star of David
  /[\u{2728}]/gu, // Sparkles
  /[\u{2733}-\u{2734}]/gu, // Eight Spoked Asterisk
  /[\u{2744}]/gu, // Snowflake
  /[\u{2747}]/gu, // Sparkle
  /[\u{274C}]/gu, // Cross Mark
  /[\u{274E}]/gu, // Cross Mark
  /[\u{2753}-\u{2755}]/gu, // Question marks
  /[\u{2757}]/gu, // Exclamation Mark
  /[\u{2763}-\u{2764}]/gu, // Heart
  /[\u{2795}-\u{2797}]/gu, // Plus, Minus, Division
  /[\u{27A1}]/gu, // Right Arrow
  /[\u{27B0}]/gu, // Curly Loop
  /[\u{27BF}]/gu, // Double Curly Loop
  /[\u{2934}-\u{2935}]/gu, // Arrows
  /[\u{2B05}-\u{2B07}]/gu, // Arrows
  /[\u{2B1B}-\u{2B1C}]/gu, // Squares
  /[\u{2B50}]/gu, // Star
  /[\u{2B55}]/gu, // Circle
  /[\u{3030}]/gu, // Wavy Dash
  /[\u{303D}]/gu, // Part Alternation Mark
  /[\u{3297}]/gu, // Circled Ideograph Congratulation
  /[\u{3299}]/gu, // Circled Ideograph Secret
];

/** Remove emojis, then collapse whitespace and trim (old stripEmojis port). */
function stripEmojisInternal(text: string): string {
  let result = text;

  for (const pattern of EMOJI_PATTERNS) {
    result = result.replace(pattern, "");
  }

  // Clean up multiple spaces and trim
  return result.replace(/\s+/g, " ").trim();
}

// Label & Slug Utilities

/**
 * Clean a label by removing brackets, #tag markers, trailing parentheticals
 * and emojis — Outline doc titles carry all of these as authoring metadata.
 */
export function cleanLabel(label: string): string {
  return stripEmojisInternal(
    label
      .replace(/^\[/, "") // Remove leading bracket
      .replace(/\]$/, "") // Remove trailing bracket
      .replace(/\s*#tag:\S+/g, "") // Remove #tag:... markers
      .replace(/\s*\([^)]*\)\s*$/, ""), // Remove trailing parenthetical
  );
}

/** Generate a URL-safe slug from text. */
export function slugify(text: string): string {
  return stripEmojisInternal(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove non-word chars except spaces and hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-+/, "") // Remove leading hyphens
    .replace(/-+$/, ""); // Remove trailing hyphens
}

/**
 * Extract slug from an Outline document URL. Keeps Outline's base62 shortid
 * suffix ("first-login-qwmPnmJsrF") but strips legacy all-hex UUID suffixes.
 */
export function extractSlugFromUrl(url: string): string {
  // Get the last segment of the URL
  const match = url.match(/\/doc\/([^/]+)$/) || url.match(/([^/]+)$/);
  if (!match) return url;

  const fullSlug = match[1];

  // Remove UUID suffix pattern (8+ hex chars at the end)
  return fullSlug.replace(/-[a-f0-9]{8,}$/i, "");
}
