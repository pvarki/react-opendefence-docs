import { describe, expect, it } from "vitest";
import { parentShelf } from "./siteSections";

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
