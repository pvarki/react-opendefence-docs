import { describe, expect, it } from "vitest";
import { docKeys, outlineUrlId } from "./outline-url-id";

describe("outlineUrlId", () => {
  it("takes the urlId from the end of a slug", () => {
    expect(outlineUrlId("takserver-groups-PQ4dCV2SYR")).toBe("PQ4dCV2SYR");
    expect(outlineUrlId("uas-tool-automatic-method-DwT6M5lj9c")).toBe(
      "DwT6M5lj9c",
    );
  });

  it("accepts a bare urlId", () => {
    expect(outlineUrlId("PQ4dCV2SYR")).toBe("PQ4dCV2SYR");
  });

  it("ignores document uuids, paths and short tails", () => {
    expect(
      outlineUrlId("2586e9d1-9343-4b54-9218-b6d5b9659a12"),
    ).toBeUndefined();
    expect(outlineUrlId("guides/tak-guide/x-PQ4dCV2SYR")).toBeUndefined();
    expect(outlineUrlId("getting-started")).toBeUndefined();
    expect(outlineUrlId("")).toBeUndefined();
  });
});

describe("docKeys", () => {
  it("lists the key, then its urlId", () => {
    expect(docKeys("old-title-PQ4dCV2SYR")).toEqual([
      "old-title-PQ4dCV2SYR",
      "PQ4dCV2SYR",
    ]);
  });

  it("lists a uuid or bare urlId once", () => {
    const uuid = "2586e9d1-9343-4b54-9218-b6d5b9659a12";
    expect(docKeys(uuid)).toEqual([uuid]);
    expect(docKeys("PQ4dCV2SYR")).toEqual(["PQ4dCV2SYR"]);
  });
});
