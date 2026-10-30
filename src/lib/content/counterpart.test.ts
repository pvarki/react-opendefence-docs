import { describe, expect, it } from "vitest";
import type { TranslationsFile } from "@shared/content-schema";
import { counterpartPath } from "./counterpart";

const en: TranslationsFile = {
  "what-is-tak-en1": {
    en: "/en/guides/tak-guide/what-is-tak-en1",
    fi: "/fi/guides/tak-guide/mika-on-tak-fi1",
    sv: "/sv/guides/tak-guide/vad-ar-tak-sv1",
  },
};
const fi: TranslationsFile = {
  "mika-on-tak-fi1": en["what-is-tak-en1"],
  // Swedish page missing or hidden: no sv link.
  "lataa-fi2": {
    en: "/en/guides/tak-guide/download-en2",
    fi: "/fi/guides/tak-guide/lataa-fi2",
  },
};
const files = [en, fi, {}];

describe("counterpartPath", () => {
  it("goes to the counterpart in the chosen locale", () => {
    expect(
      counterpartPath("/fi/guides/tak-guide/mika-on-tak-fi1", "en", files),
    ).toBe("/en/guides/tak-guide/what-is-tak-en1");
    expect(
      counterpartPath("/en/guides/tak-guide/what-is-tak-en1", "sv", files),
    ).toBe("/sv/guides/tak-guide/vad-ar-tak-sv1");
  });

  it("falls back to the English page under the chosen locale", () => {
    expect(counterpartPath("/fi/guides/tak-guide/lataa-fi2", "sv", files)).toBe(
      "/sv/guides/tak-guide/download-en2",
    );
  });

  it("finds a page shown under another locale's URL", () => {
    expect(counterpartPath("/en/guides/tak-guide/lataa-fi2", "fi", files)).toBe(
      "/fi/guides/tak-guide/lataa-fi2",
    );
  });

  it("is undefined without translation links", () => {
    expect(
      counterpartPath("/fi/guides/tak-guide/unlinked-fi3", "en", files),
    ).toBeUndefined();
    expect(
      counterpartPath("/fi/guides/tak-guide", "en", files),
    ).toBeUndefined();
    expect(counterpartPath("/fi", "en", files)).toBeUndefined();
    expect(counterpartPath("/fi/toString", "en", files)).toBeUndefined();
  });
});
