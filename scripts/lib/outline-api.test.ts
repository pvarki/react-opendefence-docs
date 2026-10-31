import { describe, expect, it } from "vitest";
import { OutlineApiError, isAccessError } from "./outline-api";

describe("isAccessError", () => {
  it("is true for 403 and 404 from Outline", () => {
    expect(isAccessError(new OutlineApiError(403, "Forbidden", "{}"))).toBe(
      true,
    );
    expect(isAccessError(new OutlineApiError(404, "Not Found", "{}"))).toBe(
      true,
    );
  });

  it("is false for other statuses and other errors", () => {
    expect(
      isAccessError(new OutlineApiError(500, "Internal Server Error", "")),
    ).toBe(false);
    expect(isAccessError(new OutlineApiError(401, "Unauthorized", ""))).toBe(
      false,
    );
    expect(isAccessError(new Error("fetch failed"))).toBe(false);
  });

  it("keeps the old error message format", () => {
    expect(new OutlineApiError(403, "Forbidden", "body").message).toBe(
      "Outline API error: 403 Forbidden - body",
    );
  });
});
