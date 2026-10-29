import { describe, expect, it } from "vitest";
import { parseOrganizerMarkers } from "./organizer-markers";

describe("parseOrganizerMarkers", () => {
  it("detects toporg and platform markers", () => {
    const m = parseOrganizerMarkers("META: toporg\nMETA: platform: android\n");
    expect(m.toporg).toBe(true);
    expect(m.platform).toBe("android");
    expect(m.underDevelopment).toBe(false);
  });

  it("flags META: incomplete", () => {
    expect(parseOrganizerMarkers("META: incomplete\n").underDevelopment).toBe(
      true,
    );
  });

  it("flags the (incomplete) parenthetical", () => {
    expect(
      parseOrganizerMarkers("iTAK guide (incomplete)").underDevelopment,
    ).toBe(true);
  });

  it("flags the under-development marker in any case", () => {
    expect(
      parseOrganizerMarkers("(this tab is under development)").underDevelopment,
    ).toBe(true);
  });

  it("does not flag other under-development wordings", () => {
    expect(
      parseOrganizerMarkers("(this page is under development)")
        .underDevelopment,
    ).toBe(false);
  });

  it("does not flag the bare word incomplete in prose", () => {
    expect(
      parseOrganizerMarkers("This chapter covers incomplete uploads.")
        .underDevelopment,
    ).toBe(false);
  });
});
