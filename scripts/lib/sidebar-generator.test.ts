import { describe, it, expect } from "vitest";

import {
  buildBook,
  cleanLabel,
  cleanTitle,
  detectPlatform,
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
  // Organizer/chapter tree:
  //   Welcome (top-level leaf -> page)
  //   Getting started (organizer -> chapter, never a page)
  //     First login (organizer with a child -> flattened into the chapter)
  //       Deep detail
  //     Second step (leaf -> page)
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

  it("never emits organizer docs as pages", () => {
    const slugs = book.readingOrder.map((r) => r.slug);
    expect(slugs).not.toContain("getting-started-Bb22222222");
    expect(slugs).not.toContain("first-login-Cc33333333");
    expect(slugs).toEqual([
      "welcome-Aa11111111",
      "deep-detail-Dd44444444",
      "second-step-Ee55555555",
    ]);
  });

  it("turns organizers into chapters and attaches them to pages", () => {
    const deep = book.readingOrder.find(
      (r) => r.slug === "deep-detail-Dd44444444",
    );
    expect(deep?.chapterId).toBe("getting-started-Bb22222222");
    expect(deep?.chapterLabel).toBe("Getting started");

    const welcome = book.readingOrder.find(
      (r) => r.slug === "welcome-Aa11111111",
    );
    expect(welcome?.chapterId).toBeUndefined();
  });

  it("keeps the sidebar at two visible levels (chapter > page)", () => {
    expect(book.sidebar.items).toHaveLength(2);
    const [welcome, group] = book.sidebar.items;
    expect(welcome).toMatchObject({
      type: "doc",
      label: "Welcome",
      slug: "welcome-Aa11111111",
    });
    expect(group.type).toBe("group");
    expect(group.label).toBe("Getting started");
    expect(group.children?.map((c) => c.slug)).toEqual([
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

describe("buildBook platform model", () => {
  // Deploy-app style: platform organizers directly under the locale root.
  const deployTree = [
    node("Android", "android-Aa11111111", [
      node("User Guide", "user-guide-Bb22222222", [
        node("Joining", "joining-Cc33333333"),
        node("Interface", "interface-Dd44444444"),
      ]),
      node("Quick note", "quick-note-Ee55555555"),
    ]),
    node("iOS", "ios-Ff66666666", [
      node("User Guide", "user-guide-Gg77777777", [
        node("Joining iOS", "joining-ios-Hh88888888"),
      ]),
    ]),
    node("Troubleshooting", "troubleshooting-Ii99999999", [
      node("Common issues", "common-issues-Jj10101010"),
    ]),
  ];

  const book = buildBook(deployTree, collection, "en");

  it("detects platform organizers and tags their pages", () => {
    expect(book.platforms.map((p) => [p.key, p.label])).toEqual([
      ["android", "Android"],
      ["ios", "iOS"],
    ]);
    const joining = book.readingOrder.find(
      (r) => r.slug === "joining-Cc33333333",
    );
    expect(joining?.platform).toBe("android");
    expect(joining?.chapterLabel).toBe("User Guide");
  });

  it("groups platform-loose leaves under the platform label", () => {
    const note = book.readingOrder.find(
      (r) => r.slug === "quick-note-Ee55555555",
    );
    expect(note?.platform).toBe("android");
    expect(note?.chapterLabel).toBe("Android");
  });

  it("keeps platform-agnostic chapters unplatformed", () => {
    const common = book.readingOrder.find(
      (r) => r.slug === "common-issues-Jj10101010",
    );
    expect(common?.platform).toBeUndefined();
    expect(common?.chapterLabel).toBe("Troubleshooting");
  });

  it("tags sidebar groups with their platform", () => {
    const groups = book.sidebar.items.filter((i) => i.type === "group");
    const userGuideAndroid = groups.find(
      (g) => g.id === "user-guide-Bb22222222",
    );
    expect(userGuideAndroid?.platform).toBe("android");
    const trouble = groups.find((g) => g.id === "troubleshooting-Ii99999999");
    expect(trouble?.platform).toBeUndefined();
  });

  it("handles TAK-style wrappers and multi-client platforms", () => {
    const takTree = [
      node("Deploy App - TAK", "tak-intro-Kk11111111"),
      node("TAK Clients", "tak-clients-Ll12121212", [
        node("ATAK", "atak-Mm13131313", [
          node("Start", "atak-start-Nn14141414", [
            node("What is TAK?", "what-is-tak-Oo15151515"),
          ]),
        ]),
        node("TAK Tracker - Android", "tracker-Pp16161616", [
          node("Start", "tracker-start-Qq17171717", [
            node("Tracker intro", "tracker-intro-Rr18181818"),
          ]),
        ]),
        node("iTAK", "itak-Ss19191919", [
          node("Start", "itak-start-Tt20202020", [
            node("iTAK intro", "itak-intro-Uu21212121"),
          ]),
        ]),
      ]),
    ];
    const tak = buildBook(takTree, collection, "en");

    // The wrapper organizer disappears; clients map onto platforms.
    expect(tak.platforms.map((p) => [p.key, p.label])).toEqual([
      ["android", "ATAK"],
      ["android", "TAK Tracker - Android"],
      ["ios", "iTAK"],
    ]);

    // Multi-client platform (android x2): chapter labels carry the client.
    const what = tak.readingOrder.find(
      (r) => r.slug === "what-is-tak-Oo15151515",
    );
    expect(what?.platform).toBe("android");
    expect(what?.chapterLabel).toBe("ATAK · Start");
    const trackerIntro = tak.readingOrder.find(
      (r) => r.slug === "tracker-intro-Rr18181818",
    );
    expect(trackerIntro?.chapterLabel).toBe("TAK Tracker - Android · Start");

    // Single-client platform keeps the bare chapter label.
    const itakIntro = tak.readingOrder.find(
      (r) => r.slug === "itak-intro-Uu21212121",
    );
    expect(itakIntro?.platform).toBe("ios");
    expect(itakIntro?.chapterLabel).toBe("Start");

    // The top-level leaf stays platform-agnostic.
    const intro = tak.readingOrder.find(
      (r) => r.slug === "tak-intro-Kk11111111",
    );
    expect(intro?.platform).toBeUndefined();
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

  it("platformFromTitle parses all five platforms", () => {
    expect(platformFromTitle("Maps #tag:android")).toBe("android");
    expect(platformFromTitle("Maps #tag:IOS")).toBe("ios");
    expect(platformFromTitle("Maps #tag:linux")).toBe("linux");
    expect(platformFromTitle("Maps")).toBeUndefined();
  });

  it("detectPlatform maps client names and platform words", () => {
    expect(detectPlatform("ATAK")).toBe("android");
    expect(detectPlatform("iTAK")).toBe("ios");
    expect(detectPlatform("WinTAK")).toBe("windows");
    expect(detectPlatform("TAK Tracker - Android")).toBe("android");
    expect(detectPlatform("TAK Tracker - Apple")).toBe("ios");
    expect(detectPlatform("MacOS")).toBe("macos");
    expect(detectPlatform("User Guide")).toBeUndefined();
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
