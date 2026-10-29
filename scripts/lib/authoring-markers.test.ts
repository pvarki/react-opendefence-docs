import { describe, it, expect } from "vitest";

import {
  findMarkerVariants,
  hasContentBesidesHideMarker,
  hasHideMarker,
  HIDE_MARKER,
  UNDER_DEVELOPMENT_MARKER,
} from "./authoring-markers";

describe("findMarkerVariants", () => {
  it("accepts the official markers in any case", () => {
    expect(
      findMarkerVariants(
        `${UNDER_DEVELOPMENT_MARKER}\n(this tab should not be shown)\n${HIDE_MARKER.toUpperCase()}`,
      ),
    ).toEqual([]);
  });

  it("reports other wordings of the under-development marker", () => {
    const text = [
      "(this page is under development)",
      "(Under development)",
      "(Tämä sivu on työn alla)",
      "(Den här sidan är under utveckling)",
    ].join("\n");
    expect(findMarkerVariants(text)).toEqual(
      text
        .split("\n")
        .map((found) => ({ found, official: UNDER_DEVELOPMENT_MARKER })),
    );
  });

  it("reports translations of the hide marker", () => {
    expect(
      findMarkerVariants(
        "(Tätä välilehteä ei pitäisi näyttää)\n(Den här fliken ska inte visas)",
      ),
    ).toEqual([
      { found: "(Tätä välilehteä ei pitäisi näyttää)", official: HIDE_MARKER },
      { found: "(Den här fliken ska inte visas)", official: HIDE_MARKER },
    ]);
  });

  it("reports near-misses of the official markers", () => {
    const text = [
      "(This tab is under development.)",
      "( This tab is under development )",
      "(This tab is under  development)",
      "(This tab should not be shown!)",
    ].join("\n");
    expect(findMarkerVariants(text).map((v) => v.official)).toEqual([
      UNDER_DEVELOPMENT_MARKER,
      UNDER_DEVELOPMENT_MARKER,
      UNDER_DEVELOPMENT_MARKER,
      HIDE_MARKER,
    ]);
  });

  it("reports a marker keyword anywhere in the parentheses", () => {
    expect(
      findMarkerVariants(
        "(Kehitteillä) (Under Development - coming soon) (Do not show this tab)",
      ),
    ).toEqual([
      { found: "(Kehitteillä)", official: UNDER_DEVELOPMENT_MARKER },
      {
        found: "(Under Development - coming soon)",
        official: UNDER_DEVELOPMENT_MARKER,
      },
      { found: "(Do not show this tab)", official: HIDE_MARKER },
    ]);
  });

  it("ignores ordinary parentheticals", () => {
    expect(
      findMarkerVariants(
        "(development/local) (visas i bilden) (local kind for development) (coming soon)",
      ),
    ).toEqual([]);
  });

  it("needs a page word for a hide look-alike", () => {
    expect(
      findMarkerVariants(
        "(visa inte lösenordet) (do not show the password) (ei näytetä kartalla)",
      ),
    ).toEqual([]);
    expect(findMarkerVariants("(Tätä sivua ei näytetä)")).toEqual([
      { found: "(Tätä sivua ei näytetä)", official: HIDE_MARKER },
    ]);
  });
});

describe("hasHideMarker", () => {
  it("finds the marker in any case, also inside a code block", () => {
    expect(hasHideMarker("```\n(THIS TAB SHOULD NOT BE SHOWN)\n```")).toBe(
      true,
    );
    expect(hasHideMarker("(Tätä välilehteä ei pitäisi näyttää)")).toBe(false);
  });
});

describe("hasContentBesidesHideMarker", () => {
  it("ignores the marker, Translations block, rules and fences", () => {
    const body = [
      "* Translations:",
      "  * fi: [Yleiskatsaus](/doc/yleiskatsaus-dSxmQoNuM0)",
      "---",
      "```",
      "(This tab should not be shown)",
      "```",
      "\\",
    ].join("\n");
    expect(hasContentBesidesHideMarker(body)).toBe(false);
  });

  it("reports real content", () => {
    expect(
      hasContentBesidesHideMarker(
        "(This tab should not be shown)\n\nOpen the stream in VLC.",
      ),
    ).toBe(true);
  });
});
