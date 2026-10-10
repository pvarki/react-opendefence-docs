import { describe, expect, it } from "vitest";
import { stripPlatformSuffix } from "./platform";

describe("stripPlatformSuffix", () => {
  it("drops OS suffixes that the adjacent icon already conveys", () => {
    expect(stripPlatformSuffix("TAK Tracker - Android")).toBe("TAK Tracker");
    expect(stripPlatformSuffix("TAK Tracker - Apple")).toBe("TAK Tracker");
    expect(stripPlatformSuffix("TAK Tracker – iOS")).toBe("TAK Tracker");
    expect(stripPlatformSuffix("ATAK - Android TAK")).toBe("ATAK");
    expect(stripPlatformSuffix("WinTAK - Windows TAK")).toBe("WinTAK");
  });

  it("leaves plain client names alone", () => {
    expect(stripPlatformSuffix("ATAK")).toBe("ATAK");
    expect(stripPlatformSuffix("WinTAK")).toBe("WinTAK");
  });

  it("keeps the label when it IS the platform name", () => {
    expect(stripPlatformSuffix("Android")).toBe("Android");
    expect(stripPlatformSuffix("macOS")).toBe("macOS");
  });
});
