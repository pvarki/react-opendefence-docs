import { describe, expect, it } from "vitest";
import { hiddenBookShelf, parentShelf } from "./siteSections";

describe("parentShelf", () => {
  it("sends each section back to the shelf that lists it", () => {
    expect(parentShelf("deploy-app").to).toBe("/$locale");
    expect(parentShelf("guides").to).toBe("/$locale/guides");
    expect(parentShelf("wikis").to).toBe("/$locale/advanced");
    expect(parentShelf("dev").to).toBe("/$locale/dev");
  });

  it("falls back to the guides shelf for an unknown book", () => {
    expect(parentShelf(undefined)).toEqual({
      to: "/$locale/guides",
      labelKey: "sidebar.allGuides",
    });
  });
});

describe("hiddenBookShelf", () => {
  it("sends a hidden book, its pages and its references to their shelf", () => {
    expect(hiddenBookShelf("architecture")).toBe("/$locale/dev");
    expect(hiddenBookShelf("architecture/some-page-AbCdEf1234")).toBe(
      "/$locale/dev",
    );
    expect(hiddenBookShelf("matrix")).toBe("/$locale/dev");
  });

  it("leaves shown books alone, lookalike slugs included", () => {
    expect(
      hiddenBookShelf("deploy-app/introduction-d1XzfzOkpz"),
    ).toBeUndefined();
    expect(hiddenBookShelf("guides/matrix-guide")).toBeUndefined();
    expect(hiddenBookShelf("wikis/tak")).toBeUndefined();
    expect(hiddenBookShelf("architectures")).toBeUndefined();
  });
});
