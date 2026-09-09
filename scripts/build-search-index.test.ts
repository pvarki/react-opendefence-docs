import { describe, expect, it } from "vitest";
import { devRefUrl, operationsText } from "./build-search-index";

describe("operationsText", () => {
  it("flattens every operation to method, path and prose", () => {
    const text = operationsText({
      paths: {
        "/api/v1/users": {
          get: { summary: "List users" },
          post: { summary: "Create user", description: "Needs mTLS." },
        },
        "/api/v1/healthcheck": { get: {} },
      },
    });
    expect(text).toContain("GET /api/v1/users List users");
    expect(text).toContain("POST /api/v1/users Create user Needs mTLS.");
    expect(text).toContain("GET /api/v1/healthcheck");
  });

  it("survives a spec with no paths", () => {
    expect(operationsText({})).toBe("");
    expect(operationsText(undefined)).toBe("");
  });
});

describe("devRefUrl", () => {
  it("deep-links a release by tag, plain otherwise", () => {
    expect(devRefUrl("matrix", "releases", "v1.3.2")).toBe(
      "/en/dev/matrix/releases?v=v1.3.2",
    );
    expect(devRefUrl("develop-deploy-app", "api")).toBe(
      "/en/dev/develop-deploy-app/api",
    );
  });
});
