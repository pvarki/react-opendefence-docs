import { describe, expect, it } from "vitest";
import {
  isCoverUnderConstruction,
  isPageUnderConstruction,
} from "./underConstruction";

describe("isPageUnderConstruction", () => {
  it("flags deploy-app windows pages but not android/ios", () => {
    expect(
      isPageUnderConstruction({
        collection: "deploy-app",
        platform: "windows",
      }),
    ).toBe(true);
    expect(
      isPageUnderConstruction({
        collection: "deploy-app",
        platform: "android",
      }),
    ).toBe(false);
    // multi-platform page that includes windows still counts
    expect(
      isPageUnderConstruction({
        collection: "deploy-app",
        platforms: ["windows", "macos"],
      }),
    ).toBe(true);
  });

  it("flags every page in the power-user wikis", () => {
    expect(isPageUnderConstruction({ collection: "wikis/tak" })).toBe(true);
    expect(isPageUnderConstruction({ collection: "wikis/mtx" })).toBe(true);
  });

  it("flags only the SUPPORTED PLUGINS chapters in the TAK guide", () => {
    expect(
      isPageUnderConstruction({
        collection: "guides/tak-guide",
        chapterId: "reports-6HdrUSYmw9",
      }),
    ).toBe(true);
    expect(
      isPageUnderConstruction({
        collection: "guides/tak-guide",
        chapterId: "start-connect-2M0PRHydCl",
      }),
    ).toBe(false);
    // a tak-guide page with no chapter is not a plugin page
    expect(isPageUnderConstruction({ collection: "guides/tak-guide" })).toBe(
      false,
    );
  });
});

describe("isCoverUnderConstruction", () => {
  it("shows on the deploy-app cover only when windows is active", () => {
    expect(isCoverUnderConstruction("deploy-app", "windows")).toBe(true);
    expect(isCoverUnderConstruction("deploy-app", "android")).toBe(false);
  });

  it("always shows on the wiki covers", () => {
    expect(isCoverUnderConstruction("wikis/tak")).toBe(true);
  });

  it("never shows on the tak-guide cover (plugins are chapter-scoped)", () => {
    expect(isCoverUnderConstruction("guides/tak-guide")).toBe(false);
  });
});
