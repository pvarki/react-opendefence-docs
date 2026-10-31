// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  counterpartRoute,
  localizeBookPages,
  localizeHrefs,
  type TranslationsByLocale,
} from "./cross-locale-links";
import type { Locale, TranslationsFile } from "../../shared/content-schema";

const EN_SYNC = "/en/guides/tak-guide/data-sync-U4cc7UE9hg";
const FI_SYNC = "/fi/guides/tak-guide/datan-synkronointi-lzOCvJIN5S";
const SV_SYNC = "/sv/guides/tak-guide/datasynkronisering-sfvICpIRhr";
const EN_GEO = "/en/guides/tak-guide/geochat-SMWfbwNItT";
const FI_GEO = "/fi/guides/tak-guide/geochat-5kOdqvslhn";

const translations: TranslationsByLocale = new Map<Locale, TranslationsFile>([
  ["en", { "data-sync-U4cc7UE9hg": { en: EN_SYNC, fi: FI_SYNC, sv: SV_SYNC } }],
  // geochat only declares its counterparts on the Finnish page.
  ["fi", { "geochat-5kOdqvslhn": { en: EN_GEO } }],
  ["sv", {}],
]);
const slugRoutes = new Map([["geochat-5kOdqvslhn", FI_GEO]]);

describe("counterpartRoute", () => {
  it("uses the target page's own Translations entry", () => {
    expect(counterpartRoute(EN_SYNC, "fi", translations, slugRoutes)).toBe(
      FI_SYNC,
    );
    expect(counterpartRoute(EN_SYNC, "sv", translations, slugRoutes)).toBe(
      SV_SYNC,
    );
  });

  it("falls back to a page in the locale that points at the target", () => {
    expect(counterpartRoute(EN_GEO, "fi", translations, slugRoutes)).toBe(
      FI_GEO,
    );
  });

  it("leaves same-locale and unknown routes alone", () => {
    expect(
      counterpartRoute(EN_SYNC, "en", translations, slugRoutes),
    ).toBeUndefined();
    expect(
      counterpartRoute(EN_GEO, "sv", translations, slugRoutes),
    ).toBeUndefined();
    expect(
      counterpartRoute(
        "/en/other/x-1234567890",
        "fi",
        translations,
        slugRoutes,
      ),
    ).toBeUndefined();
  });
});

describe("localizeHrefs", () => {
  it("rewrites known cross-locale hrefs and drops their fragment", () => {
    const html = `<p><a href="${EN_SYNC}#receive">a</a> <a href="${EN_GEO}">b</a> <a href="https://example.test/en/x">c</a></p>`;
    const result = localizeHrefs(html, "fi", translations, slugRoutes);
    expect(result.count).toBe(2);
    expect(result.html).toBe(
      `<p><a href="${FI_SYNC}">a</a> <a href="${FI_GEO}">b</a> <a href="https://example.test/en/x">c</a></p>`,
    );
  });
});

describe("localizeBookPages", () => {
  it("rewrites only page files that contain a cross-locale link", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cross-locale-"));
    const changed = path.join(dir, "a.json");
    const untouched = path.join(dir, "b.json");
    await fs.writeFile(
      changed,
      JSON.stringify({ blocks: [{ html: `<a href="${EN_SYNC}">x</a>` }] }),
    );
    const before = JSON.stringify({
      blocks: [{ html: `<a href="${FI_GEO}">y</a>` }],
    });
    await fs.writeFile(untouched, before);

    const count = await localizeBookPages(dir, "fi", translations, slugRoutes);

    expect(count).toBe(1);
    expect(JSON.parse(await fs.readFile(changed, "utf-8"))).toEqual({
      blocks: [{ html: `<a href="${FI_SYNC}">x</a>` }],
    });
    expect(await fs.readFile(untouched, "utf-8")).toBe(before);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
