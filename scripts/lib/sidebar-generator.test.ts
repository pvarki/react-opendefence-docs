import { describe, it, expect } from "vitest";

import {
  buildBook,
  cleanLabel,
  cleanTitle,
  platformFromTitle,
  slugFromUrl,
  type OutlineNavNode,
} from "./sidebar-generator";
import type { CollectionConfig } from "../../config/collections";

const collection: CollectionConfig = {
  collectionId: "00000000-0000-4000-8000-00000000aaaa",
  label: "Deploy App",
  slug: "deploy-app",
  section: "deploy-app",
  description: "Test collection",
};

let nextId = 0;
function node(
  title: string,
  slug: string,
  children: OutlineNavNode[] = [],
): OutlineNavNode {
  nextId++;
  return {
    id: `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`,
    url: `deploy-app/${slug}`,
    title,
    children,
  };
}

describe("buildBook", () => {
  // 3+-level synthetic tree:
  //   Welcome (leaf)
  //   Getting started
  //     First login
  //       Deep detail        <- depth 3
  //     Second step
  const tree = [
    node("Welcome 👋", "welcome-Aa11111111"),
    node("Getting started", "getting-started-Bb22222222", [
      node("First login", "first-login-Cc33333333", [
        node("Deep detail", "deep-detail-Dd44444444"),
      ]),
      node("Second step", "second-step-Ee55555555"),
    ]),
  ];

  const book = buildBook(tree, collection, "en");

  it("flattens to at most two visible levels", () => {
    expect(book.sidebar.items).toHaveLength(2);

    const [welcome, group] = book.sidebar.items;
    expect(welcome).toMatchObject({
      type: "doc",
      label: "Welcome",
      slug: "welcome-Aa11111111",
    });

    expect(group.type).toBe("group");
    expect(group.label).toBe("Getting started");
    // Depth-1 doc itself is the group's first doc child; depth >= 2 nodes are
    // flattened depth-first after it.
    expect(group.children?.map((c) => c.slug)).toEqual([
      "getting-started-Bb22222222",
      "first-login-Cc33333333",
      "deep-detail-Dd44444444",
      "second-step-Ee55555555",
    ]);
    expect(group.children?.every((c) => c.type === "doc")).toBe(true);
    expect(group.children?.every((c) => !c.children)).toBe(true);
  });

  it("produces depth-first pre-order readingOrder", () => {
    expect(book.readingOrder.map((r) => r.slug)).toEqual([
      "welcome-Aa11111111",
      "getting-started-Bb22222222",
      "first-login-Cc33333333",
      "deep-detail-Dd44444444",
      "second-step-Ee55555555",
    ]);
  });

  it("preserves the full original path in breadcrumbs", () => {
    const deep = book.readingOrder.find(
      (r) => r.slug === "deep-detail-Dd44444444",
    );
    expect(deep?.breadcrumb).toEqual([
      "Getting started",
      "First login",
      "Deep detail",
    ]);
    const top = book.readingOrder.find((r) => r.slug === "welcome-Aa11111111");
    expect(top?.breadcrumb).toEqual(["Welcome"]);
  });

  it("emits the new SidebarConfig shape", () => {
    expect(book.sidebar.schemaVersion).toBe(1);
    expect(book.sidebar.label).toBe("Deploy App");
    expect(book.sidebar.slug).toBe("deploy-app");
  });

  it("extracts platform tags into refs", () => {
    const tagged = buildBook(
      [node("Maps #tag:android", "maps-Ff66666666")],
      collection,
      "en",
    );
    expect(tagged.readingOrder[0].platform).toBe("android");
    expect(tagged.readingOrder[0].title).toBe("Maps");
    expect(tagged.sidebar.items[0].label).toBe("Maps");
  });
});

describe("label/title cleanup", () => {
  it("cleanLabel strips brackets, tags, trailing parentheticals and emojis", () => {
    expect(cleanLabel("[Settings]")).toBe("Settings");
    expect(cleanLabel("Maps #tag:android")).toBe("Maps");
    expect(cleanLabel("Login (advanced)")).toBe("Login");
    expect(cleanLabel("Hello 🚀 world")).toBe("Hello world");
  });

  it("cleanTitle keeps trailing parentheticals", () => {
    expect(cleanTitle("Login (advanced) #tag:ios")).toBe("Login (advanced)");
  });

  it("platformFromTitle parses known platforms only", () => {
    expect(platformFromTitle("Maps #tag:android")).toBe("android");
    expect(platformFromTitle("Maps #tag:IOS")).toBe("ios");
    expect(platformFromTitle("Maps #tag:linux")).toBeUndefined();
    expect(platformFromTitle("Maps")).toBeUndefined();
  });

  it("slugFromUrl keeps the shortid suffix", () => {
    expect(slugFromUrl("deploy-app/first-login-qwmPnmJsrF")).toBe(
      "first-login-qwmPnmJsrF",
    );
    expect(slugFromUrl("guides/tak-guide/foo-Bar1234567")).toBe(
      "foo-Bar1234567",
    );
  });
});
