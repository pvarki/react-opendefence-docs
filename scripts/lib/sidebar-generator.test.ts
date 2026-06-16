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

  it("extracts several platform tags into a multi-platform ref + sidebar item", () => {
    const multi = buildBook(
      [
        node(
          "Set up on desktop #tag:windows #tag:macos #tag:linux",
          "setup-Gg77777777",
        ),
      ],
      collection,
      "en",
    );
    const ref = multi.readingOrder[0];
    expect(ref.platforms).toEqual(["windows", "macos", "linux"]);
    // Multi-platform pages aren't pinned to a single `platform`.
    expect(ref.platform).toBeUndefined();
    expect(ref.title).toBe("Set up on desktop");
    const docItem = multi.sidebar.items[0];
    expect(docItem.label).toBe("Set up on desktop");
    expect(docItem.platforms).toEqual(["windows", "macos", "linux"]);
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

  it("detects client organizers and tags their pages", () => {
    expect(book.clients.map((c) => [c.platform, c.label, c.id])).toEqual([
      ["android", "Android", "android-Aa11111111"],
      ["ios", "iOS", "ios-Ff66666666"],
    ]);
    const joining = book.readingOrder.find(
      (r) => r.slug === "joining-Cc33333333",
    );
    expect(joining?.platform).toBe("android");
    expect(joining?.clientId).toBe("android-Aa11111111");
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

  it("tags sidebar groups with their client", () => {
    const groups = book.sidebar.items.filter((i) => i.type === "group");
    const userGuideAndroid = groups.find(
      (g) => g.id === "user-guide-Bb22222222",
    );
    expect(userGuideAndroid?.clientId).toBe("android-Aa11111111");
    const trouble = groups.find((g) => g.id === "troubleshooting-Ii99999999");
    expect(trouble?.clientId).toBeUndefined();
  });

  it("handles TAK-style wrappers; every client is its own selector entry", () => {
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

    // The wrapper organizer disappears; each client is selectable on its
    // own (TAK Tracker is NOT merged into ATAK's android entry).
    expect(tak.clients.map((c) => [c.platform, c.label])).toEqual([
      ["android", "ATAK"],
      ["android", "TAK Tracker - Android"],
      ["ios", "iTAK"],
    ]);

    // Pages carry their client; chapter labels stay bare (clients never mix).
    const what = tak.readingOrder.find(
      (r) => r.slug === "what-is-tak-Oo15151515",
    );
    expect(what?.clientId).toBe("atak-Mm13131313");
    expect(what?.chapterLabel).toBe("Start");
    const trackerIntro = tak.readingOrder.find(
      (r) => r.slug === "tracker-intro-Rr18181818",
    );
    expect(trackerIntro?.clientId).toBe("tracker-Pp16161616");
    expect(trackerIntro?.chapterLabel).toBe("Start");

    // The top-level leaf stays client-agnostic.
    const intro = tak.readingOrder.find(
      (r) => r.slug === "tak-intro-Kk11111111",
    );
    expect(intro?.clientId).toBeUndefined();
  });

  it("META markers: toporg sections group chapters; platform marker makes a client", () => {
    const fooClientId = "id-foo-client";
    const introTopId = "id-toporg-intro";
    const tree = [
      node("FooApp", "fooapp-Vv22222222", [
        node("INTRODUCTION", "introduction-Ww23232323", [
          node("Welcome", "welcome-Xx24242424"),
          node("Start", "start-Yy25252525", [
            node("Install", "install-Zz26262626"),
          ]),
        ]),
        node("Advanced", "advanced-Ab27272727", [
          node("Plugins", "plugins-Ac28282828"),
        ]),
      ]),
    ];
    // Stamp deterministic ids for the marker maps.
    tree[0].id = fooClientId;
    tree[0].children[0].id = introTopId;

    const built = buildBook(tree, collection, "en", {
      toporgIds: new Set([introTopId]),
      platformByDocId: new Map([[fooClientId, "android"]]),
      platformsContainerIds: new Set(),
      osByDocId: new Map(),
      isProductDocIds: new Set(),
    });

    // META: platform made FooApp a client despite the unknown name.
    expect(built.clients).toEqual([
      {
        id: "fooapp-Vv22222222",
        platform: "android",
        label: "FooApp",
        docId: fooClientId,
      },
    ]);

    // META: toporg made INTRODUCTION a section heading with a loose page and
    // a chapter inside; Advanced stays a plain chapter at client level.
    const toporg = built.sidebar.items.find((i) => i.type === "toporg");
    expect(toporg?.label).toBe("INTRODUCTION");
    expect(toporg?.clientId).toBe("fooapp-Vv22222222");
    expect(toporg?.children?.map((c) => [c.type, c.label])).toEqual([
      ["doc", "Welcome"],
      ["group", "Start"],
    ]);

    // Loose page under the toporg: chapter = the toporg itself.
    const welcome = built.readingOrder.find(
      (r) => r.slug === "welcome-Xx24242424",
    );
    expect(welcome?.chapterLabel).toBe("INTRODUCTION");
    expect(welcome?.clientId).toBe("fooapp-Vv22222222");
    // Chapter page inside the toporg keeps the chapter label.
    const install = built.readingOrder.find(
      (r) => r.slug === "install-Zz26262626",
    );
    expect(install?.chapterLabel).toBe("Start");

    // Reading order is pre-order through the whole client.
    expect(built.readingOrder.map((r) => r.slug)).toEqual([
      "welcome-Xx24242424",
      "install-Zz26262626",
      "plugins-Ac28282828",
    ]);
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
