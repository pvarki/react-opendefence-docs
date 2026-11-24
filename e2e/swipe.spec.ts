import { expect, test, type Locator, type Page } from "@playwright/test";

// Real synced content: deploy-app, android platform, User Guide chapter.
// INTRO is shown on every platform and opens the whole reading order.
const INTRO = "/en/deploy-app/introduction-d1XzfzOkpz";
const FIRST = "/en/deploy-app/joining-a-deploy-app-p9htrbBL4S";
const SECOND = "/en/deploy-app/using-applications-CsobZMZ45Q";
const THIRD = "/en/deploy-app/interface-4Ncp4affe9";
const ADMIN_FIRST = "/en/deploy-app/first-login-qwmPnmJsrF";

// Onboarding modals aria-hide the page behind them and swallow gestures.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("od-intro-seen-v1", "1");
    localStorage.setItem("od-orient-seen-v1", "1");
  });
});

/** The active pane only — neighbor panes are mounted (inert) for the swipe reveal. */
function currentPane(page: Page) {
  return page.locator("[data-current]");
}

/** Navigate and wait until the reader is interactive (pane mounted + hydrated). */
async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(currentPane(page)).toHaveCount(1);
  await expect(currentPane(page).getByRole("heading").first()).toBeVisible();
}

// Embla uses pointer events, so a mouse drag matches touch.
async function swipe(page: Page, direction: "left" | "right") {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  const title = await currentPane(page).locator("h1").first().boundingBox();
  // The reader's box, not the pane's: a page is current while it still glides
  // in, and a swipe is aimed at the screen.
  const reader = await page.locator("[data-reader-root]").boundingBox();
  const y = title ? title.y + title.height / 2 : 80;
  const left = reader?.x ?? 0;
  const width = reader?.width ?? viewport.width;
  // From rest: a drag that catches the previous turn mid-glide adds to it,
  // and how far that got depends on how loaded the machine is.
  await expect
    .poll(async () =>
      Math.abs(((await currentPane(page).boundingBox())?.x ?? left) - left),
    )
    .toBeLessThan(2);
  const from = left + width * (direction === "left" ? 0.8 : 0.2);
  const to = left + width * (direction === "left" ? 0.2 : 0.8);
  await page.mouse.move(from, y);
  await page.mouse.down();
  await page.mouse.move(to, y, { steps: 8 });
  await page.mouse.up();
}

/**
 * A touch swipe via synthetic pointer events (pointerType "touch"). Unlike a
 * mouse drag, touch never starts a text selection — which is exactly the
 * real-device gesture the landing-page swipe listens for (the in-book reader's
 * Embla owns the pointer instead and so works under a mouse drag too).
 */
async function touchSwipe(page: Page, direction: "left" | "right") {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  await page.evaluate(
    ({ width, dir }) => {
      const y = 80;
      const from = dir === "left" ? width * 0.8 : width * 0.2;
      const to = dir === "left" ? width * 0.2 : width * 0.8;
      const el = document.elementFromPoint(from, y) ?? document.body;
      const at = (type: string, x: number) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            pointerType: "touch",
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
          }),
        );
      at("pointerdown", from);
      at("pointermove", (from + to) / 2);
      at("pointerup", to);
    },
    { width: viewport.width, dir: direction },
  );
}

/**
 * A real finger, through CDP touch events. The browser may claim these for
 * panning and cancel the pointer — synthetic PointerEvents never go through
 * that, so they cannot tell whether a swipe survives on a device.
 */
async function fingerSwipe(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const cdp = await page.context().newCDPSession(page);
  const steps = 8;
  let timestamp = Date.now() / 1000;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [from],
    timestamp,
  });
  for (let i = 1; i <= steps; i++) {
    timestamp += 0.015;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * i) / steps,
          y: from.y + ((to.y - from.y) * i) / steps,
        },
      ],
      timestamp,
    });
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
    timestamp: timestamp + 0.005,
  });
}

/**
 * A two-finger trackpad flick and the inertia the OS adds after it, as the
 * one dense stream a trackpad sends. Dispatched in the page: sent through CDP
 * the events drift apart on a loaded machine and read as several swipes.
 */
async function trackpadSwipe(target: Locator) {
  await target.evaluate((el) => {
    for (const deltaX of [20, 35, 40, 35, 20, ...Array<number>(30).fill(25)]) {
      el.dispatchEvent(new WheelEvent("wheel", { deltaX, bubbles: true }));
    }
  });
}

test.describe("book swipe navigation", () => {
  test("swipe left turns to the next page and pushes history", async ({
    page,
  }) => {
    await open(page, FIRST);
    await swipe(page, "left");
    await expect(page).toHaveURL(SECOND);
    await expect(
      currentPane(page).getByRole("heading", {
        name: "Using applications",
        exact: true,
      }),
    ).toBeVisible();

    await swipe(page, "left");
    await expect(page).toHaveURL(THIRD);
  });

  test("swipe right turns back to the previous page", async ({ page }) => {
    await open(page, SECOND);
    await swipe(page, "right");
    await expect(page).toHaveURL(FIRST);
  });

  test("browser back lands on the previously read page", async ({ page }) => {
    await open(page, FIRST);
    await swipe(page, "left");
    await expect(page).toHaveURL(SECOND);

    await page.goBack();
    await expect(page).toHaveURL(FIRST);
    await expect(
      currentPane(page).getByRole("heading", { name: "Joining a Deploy App" }),
    ).toBeVisible();
  });

  test("swipe right on the first page stays put (rubber band)", async ({
    page,
  }) => {
    await open(page, INTRO);
    await swipe(page, "right");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(INTRO);
  });

  test("a trackpad swipe turns one page, inertia and all", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "trackpads are desktop");
    await open(page, FIRST);
    await trackpadSwipe(currentPane(page).locator("h1"));
    await expect(page).toHaveURL(SECOND);
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(SECOND);
  });

  test("a trackpad swipe over the slideshow steps a slide, not the page", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "trackpads are desktop");
    await open(page, FIRST);
    const deck = page.locator("[data-current] [data-swipe-scope]").first();
    await trackpadSwipe(deck.locator("[aria-roledescription=slide]").first());
    await expect(page).toHaveURL(`${FIRST}?slide=2`);
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(`${FIRST}?slide=2`);
  });

  test("quick arrow presses turn exactly that many pages", async ({ page }) => {
    await open(page, FIRST);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(60);
    }
    await expect(page).toHaveURL(ADMIN_FIRST);
    // Nothing follows on its own once the turns have played out.
    await page.waitForTimeout(2500);
    await expect(page).toHaveURL(ADMIN_FIRST);
    await page.goBack();
    await expect(page).toHaveURL(THIRD);
  });

  test("reversing a page turn mid-way lands back on a live page", async ({
    page,
  }) => {
    await open(page, SECOND);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(SECOND);
    await page.waitForTimeout(2500);
    await expect(page).toHaveURL(SECOND);
    await expect(
      currentPane(page).getByRole("heading", {
        name: "Using applications",
        exact: true,
      }),
    ).toBeInViewport();
    // Live: its own link works.
    await currentPane(page).getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(THIRD);
  });

  test("a turned page is interactive at once", async ({ page }) => {
    await open(page, FIRST);
    await currentPane(page).getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(SECOND);
    // No waiting for the page turn to finish.
    await currentPane(page).getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(THIRD);
  });

  test("keyboard arrows turn pages", async ({ page }) => {
    await open(page, FIRST);
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(SECOND);
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(FIRST);
  });

  test("prev/next links navigate", async ({ page }) => {
    await open(page, FIRST);
    await currentPane(page).getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(SECOND);
    // The pane is still sliding when the URL changes; wait for it to arrive.
    await expect(
      currentPane(page).getByRole("heading", {
        name: "Using applications",
        exact: true,
      }),
    ).toBeVisible();
    await currentPane(page).getByRole("link", { name: "Previous" }).click();
    await expect(page).toHaveURL(FIRST);
  });

  test("swipe flows across chapter boundaries (User Guide -> Admin Guide)", async ({
    page,
  }) => {
    await open(page, THIRD); // last User Guide page
    await swipe(page, "left");
    await expect(page).toHaveURL(ADMIN_FIRST);
  });

  test("swipe flows across book boundaries (Deploy App -> TAK Guide)", async ({
    page,
  }) => {
    // Last android page of deploy-app continues into the TAK guide. Read it
    // from the manifest: new Outline pages move it on every sync.
    const response = await page.request.get("/content/en/manifest.json");
    const manifest = (await response.json()) as {
      pages: { collection: string; slug: string; breadcrumb: string[] }[];
    };
    const lastAndroid = manifest.pages
      .filter(
        (p) =>
          p.collection === "deploy-app" && p.breadcrumb.includes("Android"),
      )
      .at(-1);
    if (!lastAndroid) throw new Error("no android page in deploy-app");
    const last = `/en/deploy-app/${lastAndroid.slug}`;
    await open(page, last);
    await swipe(page, "left");
    await expect(page).toHaveURL("/en/guides/tak-guide");
    // Covers are shelf stops, so swiping does not re-enter the previous book.
    await page.goBack();
    await expect(page).toHaveURL(last);
  });

  test("drags inside the slideshow turn slides, never the page", async ({
    page,
  }, testInfo) => {
    await open(page, FIRST);
    const scope = page.locator("[data-current] [data-swipe-scope]").first();
    await scope.scrollIntoViewIfNeeded();
    const box = await scope.boundingBox();
    if (!box) throw new Error("slideshow not visible");
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.8, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    // The slide changed, the page did not: the ?slide deep link follows.
    await expect(page).toHaveURL(`${FIRST}?slide=2`);
    if (testInfo.project.name === "mobile") {
      await expect(
        scope.getByText("2/", { exact: false }).first(),
      ).toBeVisible();
    }
  });

  test("edge gestures are ignored (dead zone)", async ({ page }) => {
    await open(page, SECOND);
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("no viewport");
    await page.mouse.move(10, 80); // inside the 32px dead zone
    await page.mouse.down();
    await page.mouse.move(viewport.width * 0.7, 80, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(SECOND);
  });

  test("deep link mid-book renders and can swipe both ways", async ({
    page,
  }) => {
    await open(page, SECOND);
    await swipe(page, "left");
    await expect(page).toHaveURL(THIRD);
    await swipe(page, "right");
    await expect(page).toHaveURL(SECOND);
    await swipe(page, "right");
    await expect(page).toHaveURL(FIRST);
  });

  test("reading progress bar advances", async ({ page }) => {
    await open(page, FIRST);
    const bar = page.getByTestId("reading-progress");
    const w1 = await bar.evaluate((el) => el.getBoundingClientRect().width);
    await swipe(page, "left");
    await expect(page).toHaveURL(SECOND);
    await expect
      .poll(() => bar.evaluate((el) => el.getBoundingClientRect().width))
      .toBeGreaterThan(w1);
  });
});

test.describe("bookshelf-level swipe (landing pages)", () => {
  // Open a landing page and wait until its content is on screen.
  async function openShelf(page: Page, url: string) {
    await page.goto(url);
    await expect(page.locator("main")).toBeVisible();
    await expect(
      page.locator("main").getByRole("heading").first(),
    ).toBeVisible();
  }

  // Let the View Transition finish and the route's effects flush before the
  // next gesture (the swipe reads the current stop from a ref updated on
  // render).
  async function settle(page: Page) {
    await page.waitForTimeout(450);
  }

  test("swipe left walks Home → Deploy App → Guides → Advanced → Develop", async ({
    page,
  }) => {
    await openShelf(page, "/en");
    await touchSwipe(page, "left");
    await expect(page).toHaveURL("/en/deploy-app");
    await settle(page);

    await touchSwipe(page, "left");
    await expect(page).toHaveURL("/en/guides");
    await settle(page);

    await touchSwipe(page, "left");
    await expect(page).toHaveURL("/en/advanced");
    await settle(page);

    await touchSwipe(page, "left");
    await expect(page).toHaveURL("/en/dev");
  });

  test("a real finger swipe turns between landing pages", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "needs a touch screen");
    await openShelf(page, "/en");
    await fingerSwipe(page, { x: 330, y: 300 }, { x: 80, y: 305 });
    await expect(page).toHaveURL("/en/deploy-app");
    await settle(page);
    // A vertical drag is a scroll, not a turn.
    await fingerSwipe(page, { x: 200, y: 500 }, { x: 205, y: 250 });
    await page.waitForTimeout(500);
    await expect(page).toHaveURL("/en/deploy-app");
  });

  test("swipe right walks back toward Home", async ({ page }) => {
    await openShelf(page, "/en/guides");
    await touchSwipe(page, "right");
    await expect(page).toHaveURL("/en/deploy-app");
    await settle(page);

    await touchSwipe(page, "right");
    await expect(page).toHaveURL("/en");
  });

  test("swipe right on Home stays put (no stop before it)", async ({
    page,
  }) => {
    await openShelf(page, "/en");
    await touchSwipe(page, "right");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL("/en");
  });

  test("swipe left on the last stop (Develop) stays put", async ({ page }) => {
    await openShelf(page, "/en/dev");
    await touchSwipe(page, "left");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL("/en/dev");
  });

  test("arrow keys turn between landing pages", async ({ page }) => {
    await openShelf(page, "/en/guides");
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL("/en/advanced");
    await settle(page);
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL("/en/guides");
  });

  test("the Deploy App cover swipes as a stop, then hands off to the reader", async ({
    page,
  }) => {
    // The cover is a landing stop: swiping turns to the next shelf, not into
    // the book.
    await openShelf(page, "/en/deploy-app");
    await touchSwipe(page, "left");
    await expect(page).toHaveURL("/en/guides");
    await settle(page);

    // Inside the book (a content page) the reader's own swipe takes over.
    await open(page, FIRST);
    await swipe(page, "left");
    await expect(page).toHaveURL(SECOND);
  });

  test("reduced motion still navigates (instant swap, no slide)", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openShelf(page, "/en");
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL("/en/deploy-app");
    await settle(page);
    await touchSwipe(page, "left");
    await expect(page).toHaveURL("/en/guides");
  });

  test("a second finger (pinch) does not turn the page", async ({ page }) => {
    await openShelf(page, "/en/guides");
    await page.evaluate(() => {
      const y = 80;
      const el = document.elementFromPoint(200, y) ?? document.body;
      const fire = (type: string, id: number, x: number) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            pointerType: "touch",
            clientX: x,
            clientY: y,
            bubbles: true,
          }),
        );
      fire("pointerdown", 1, 200); // first finger
      fire("pointerdown", 2, 210); // second finger poisons the gesture
      fire("pointermove", 1, 40);
      fire("pointermove", 2, 400);
      fire("pointerup", 1, 40); // a wide horizontal spread on release
      fire("pointerup", 2, 400);
    });
    await page.waitForTimeout(500);
    await expect(page).toHaveURL("/en/guides");
  });
});

test.describe("contextual bottom bar (mobile)", () => {
  test("five controls in order: Contents, Home, shelf, Platform, Search", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "bottom bar is mobile-only");
    await page.goto(FIRST);
    const bar = page.locator("nav.fixed");
    const boxes = [];
    for (const [role, name] of [
      ["button", "Contents"],
      ["link", "Home"],
      ["link", "Guides"],
      ["button", "Platform"],
      ["link", "Search"],
    ] as const) {
      const el = bar.getByRole(role, { name });
      await expect(el).toBeVisible();
      boxes.push((await el.boundingBox())!.x);
    }
    // Left-to-right exactly in this order.
    expect([...boxes].sort((a, b) => a - b)).toEqual(boxes);
  });

  test("platform button only appears inside books with platforms", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "bottom bar is mobile-only");
    await page.goto("/en");
    const bar = page.locator("nav.fixed");
    await expect(bar.getByRole("link", { name: "Search" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Platform" })).toHaveCount(0);
  });

  test("the shelf slot is context-aware: Advanced in wikis, Developer in dev", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "bottom bar is mobile-only");
    await page.goto("/en/advanced");
    const bar = page.locator("nav.fixed");
    await expect(bar.getByRole("link", { name: "Advanced" })).toBeVisible();
    // Inside a wiki book it stays Advanced.
    await page.goto("/en/wikis/tak");
    await expect(bar.getByRole("link", { name: "Advanced" })).toBeVisible();
    await page.goto("/en/dev");
    await expect(bar.getByRole("link", { name: "Developer" })).toBeVisible();
  });

  test("contents outside a reader opens the site-wide TOC", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "bottom bar is mobile-only");
    await page.goto("/en");
    await page.getByRole("button", { name: "Contents" }).click();
    await expect(page.getByRole("link", { name: "TAK Guide" })).toBeVisible();
    await expect(page.getByRole("link", { name: "TAK Wiki" })).toBeVisible();
  });

  test("platform sheet picks a platform and lands on its first page", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "bottom bar is mobile-only");
    await open(page, FIRST); // android page
    await page
      .locator("nav.fixed")
      .getByRole("button", { name: "Platform" })
      .click();
    await page.getByRole("button", { name: "iOS" }).click();
    // Current page is android-only: the pick continues at iOS's first page.
    await expect(page).toHaveURL("/en/deploy-app/introduction-d1XzfzOkpz");
  });

  test("contents (leftmost) opens the platform-filtered book TOC", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "bottom bar is mobile-only");
    await open(page, FIRST);
    await page.getByRole("button", { name: "Contents" }).click();
    // The User Guide group auto-opens (contains the current page).
    await page.getByRole("link", { name: "Using applications" }).click();
    await expect(page).toHaveURL(SECOND);
  });
});

test.describe("platform selector", () => {
  test("deep link into a platform's page switches the selector", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "asserts navbar selector");
    // Desktop UA defaults to macOS; an android deep link must win.
    await open(page, FIRST);
    await expect(
      page.getByRole("combobox", { name: "Platform" }),
    ).toContainText("Android");
  });

  test("bottom bar shows the active client label on mobile (ATAK in TAK guide)", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "asserts mobile bottom bar");
    await open(page, "/en/guides/tak-guide/what-is-tak-Vy8mUPLS87");
    await expect(
      page.locator("nav.fixed").getByRole("button", { name: "Platform" }),
    ).toContainText("ATAK");
  });

  test("TAK guide lists every client separately (incl. TAK Tracker)", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "asserts navbar selector");
    await page.goto("/en/guides/tak-guide");
    const selector = page.getByRole("combobox", { name: "Platform" });
    await selector.click();
    await expect(page.getByRole("option", { name: "ATAK" })).toBeVisible();
    await expect(page.getByRole("option", { name: "iTAK" })).toBeVisible();
    // Both TAK Trackers read the same — the OS icon tells them apart.
    await expect(
      page.getByRole("option", { name: "TAK Tracker", exact: true }),
    ).toHaveCount(2);
    await page.getByRole("option", { name: "WinTAK" }).click();
    // Cover now lists the WinTAK reading order.
    await expect(
      page.locator("main").getByText("WinTAK", { exact: false }).first(),
    ).toBeVisible();
  });
});

test.describe("book cover", () => {
  test("Start reading is up top, Tell me more collapsed, contents only in the sidebar", async ({
    page,
  }) => {
    await page.goto("/en/deploy-app");
    await expect(
      page.getByRole("link", { name: "Start reading" }),
    ).toBeInViewport();
    await expect(
      page.locator("details", { hasText: "Tell me more" }),
    ).toHaveJSProperty("open", false);
    await expect(
      page.getByRole("navigation", { name: "Contents" }),
    ).toHaveCount(0);
  });
});

test.describe("locale fallback", () => {
  test("untranslated page shows English content with a banner", async ({
    page,
  }) => {
    await page.goto(`/fi${FIRST.slice(3)}`);
    await expect(
      page
        .locator("[data-current]")
        .getByRole("heading", { name: "Joining a Deploy App" }),
    ).toBeVisible();
    await expect(
      page.getByText("Tätä sivua ei ole vielä suomeksi", { exact: false }),
    ).toBeVisible();
  });

  test("page without an English version shows the Finnish one", async ({
    page,
  }) => {
    await page.goto("/en/deploy-app/liittyminen-deploy-appiin-hFiNczU5i7");
    await expect(
      page
        .locator("[data-current]")
        .getByRole("heading", { name: "Liittyminen Deploy Appiin" }),
    ).toBeVisible();
    await expect(
      page.getByText("Showing the Finnish version", { exact: false }),
    ).toBeVisible();
  });

  test("desktop sidebar shows the platform's book tree with active page", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only affordance");
    await open(page, SECOND);
    const sidebar = page.locator("aside");
    await expect(
      sidebar.getByRole("link", { name: "Using applications", exact: true }),
    ).toBeVisible();
  });
});

test.describe("search", () => {
  test("full-text search finds pages by body content", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile",
      "search tab is the mobile entry",
    );
    await page.goto("/en/search");
    await page.getByRole("searchbox").fill("certificate");
    await expect(page.locator("main a").first()).toBeVisible();
  });

  test("command palette searches and navigates on desktop", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "palette is desktop-only");
    await page.goto("/en");
    await page.getByRole("button", { name: "Search docs…" }).click();
    await page.getByPlaceholder("Search docs…").fill("ATAK");
    const option = page.getByRole("option").first();
    await expect(option).toBeVisible();
    await option.click();
    await expect(page).toHaveURL(/\/en\/[^/]+(\/[^/]+)+$/);
  });
});

test.describe("unified guides page and back button", () => {
  test("guides page holds Deploy App + Products only; wikis live on Advanced", async ({
    page,
  }) => {
    await page.goto("/en/guides");
    const main = page.locator("main");
    await expect(
      main.getByRole("heading", { name: "Deploy App", exact: true }),
    ).toBeVisible();
    await expect(
      main.getByRole("heading", { name: "Products", exact: true }),
    ).toBeVisible();
    await expect(main.getByRole("link", { name: /TAK Guide/ })).toBeVisible();
    await expect(main.getByRole("link", { name: /TAK Wiki/ })).toHaveCount(0);
    await page.goto("/en/advanced");
    await expect(main.getByRole("link", { name: /TAK Wiki/ })).toBeVisible();
  });

  test("installed app: floating back button returns to the earlier place", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "back button is mobile-only");
    // The button only shows in the installed app.
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q: string) =>
        q.includes("display-mode: standalone")
          ? ({ ...real(q), matches: true } as MediaQueryList)
          : real(q);
    });
    await page.goto("/en");
    await page.getByRole("link", { name: /power user/i }).click();
    await expect(page).toHaveURL("/en/advanced");
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL("/en");
  });

  test("in a browser there is no floating back button", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "back button is mobile-only");
    await page.goto("/en");
    await page.getByRole("link", { name: /power user/i }).click();
    await expect(page).toHaveURL("/en/advanced");
    await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
  });
});

test.describe("slideshow flows into the book", () => {
  test("overdragging past the last slide turns the page", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile deck gesture");
    await open(page, FIRST);
    const scope = page.locator("[data-current] [data-swipe-scope]").first();
    // Jump to the last slide via its dot, then drag forward past the edge.
    // The slide count comes from the "1/N" counter, so content edits in
    // Outline do not break the test.
    const counter = await scope
      .getByText(/^1\/\d+$/)
      .first()
      .textContent();
    const total = counter?.split("/")[1];
    if (!total) throw new Error("slide counter not found");
    await scope.getByRole("button", { name: total, exact: true }).click();
    await expect(scope.getByText(`${total}/${total}`)).toBeVisible();
    await page.waitForTimeout(500); // let the deck settle on the last slide
    const box = await scope.boundingBox();
    if (!box) throw new Error("deck not visible");
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.9, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.05, y, { steps: 10 });
    await page.mouse.up();
    await expect(page).toHaveURL(SECOND);
  });

  test("Previous and Next walk on into the neighbouring pages", async ({
    page,
  }) => {
    await open(page, SECOND);
    const deck = () =>
      page.locator("[data-current] [data-swipe-scope]").first();
    // Previous on the first slide: the previous page, on its last slide.
    await deck().getByRole("button", { name: "Previous page" }).click();
    await expect(page).toHaveURL(new RegExp(`${FIRST}\\?slide=\\d+$`));
    const last = /(\d+)$/.exec(page.url())![1];
    await expect(
      deck()
        .getByText(new RegExp(`${last}\\s*(of|/)\\s*${last}`))
        .first(),
    ).toBeVisible();
    // Next on the last slide: the next page, on its first slide.
    await deck()
      .getByRole("button", { name: "Next page", exact: true })
      .click();
    await expect(page).toHaveURL(SECOND);
    await expect(
      deck()
        .getByText(/\b1\s*(of|\/)\s*\d+/)
        .first(),
    ).toBeVisible();
  });

  test("the slideshow fits the first screen, controls included", async ({
    page,
  }) => {
    await open(page, FIRST);
    const deck = page.locator("[data-current] [data-swipe-scope]").first();
    await expect(currentPane(page).locator("h1")).toBeInViewport({ ratio: 1 });
    await expect(deck.locator('[data-step="1"]')).toBeInViewport({ ratio: 1 });
    await expect(deck.locator('[data-step="-1"]')).toBeInViewport({ ratio: 1 });
  });

  test("a malformed ?slide opens the first slide", async ({ page }) => {
    await open(page, `${FIRST}?slide=abc`);
    const deck = page.locator("[data-current] [data-swipe-scope]").first();
    await expect(deck.getByText(/\b1\s*(of|\/)\s*\d+/).first()).toBeVisible();
    await deck.locator('[data-step="1"]').click();
    await expect(page).toHaveURL(`${FIRST}?slide=2`);
  });

  test("arrow keys in the image lightbox do not turn the page", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "keyboard");
    // The last slide: the deck's own ArrowRight would walk on to the next page.
    await open(page, `${FIRST}?slide=last`);
    const deck = page.locator("[data-current] [data-swipe-scope]").first();
    await expect(deck.getByText(/(\d+) of \1$/)).toBeVisible();
    const opened = new URL(page.url()).pathname;
    await deck.locator("[aria-roledescription=slide]:not([inert]) img").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname).toBe(opened);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("a narrow deck keeps its controls inside and apart", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop control row");
    await page.setViewportSize({ width: 800, height: 600 });
    await open(page, FIRST);
    const deck = page.locator("[data-current] [data-swipe-scope]").first();
    const [frame, prev, next, count] = await Promise.all([
      deck.boundingBox(),
      deck.locator('[data-step="-1"]').boundingBox(),
      deck.locator('[data-step="1"]').boundingBox(),
      deck.getByText(/^Step \d+ of \d+$/).boundingBox(),
    ]);
    if (!frame || !prev || !next || !count) throw new Error("deck not visible");
    expect(prev.x).toBeGreaterThanOrEqual(frame.x);
    expect(next.x + next.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(count.x).toBeGreaterThanOrEqual(prev.x + prev.width);
    expect(count.x + count.width).toBeLessThanOrEqual(next.x);
  });

  test("skip button leaves the deck mid-slides", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile deck control");
    await open(page, FIRST);
    const scope = page.locator("[data-current] [data-swipe-scope]").first();
    // Still on slide 1 of 8 — the skip control goes straight to the next page.
    await scope.getByRole("button", { name: "Next page" }).click();
    await expect(page).toHaveURL(SECOND);
  });
});

test.describe("shelves under construction", () => {
  test("Advanced carries the notice and still lists its books", async ({
    page,
  }) => {
    await page.goto("/en/advanced");
    const main = page.locator("main");
    await expect(main.getByRole("note")).toContainText("Under construction");
    await expect(main.getByRole("link", { name: /TAK Wiki/ })).toBeVisible();
  });

  test("every wiki cover and page carries the notice", async ({ page }) => {
    await page.goto("/en/wikis/tak");
    await expect(page.locator("main").getByRole("note")).toBeVisible();
    const manifest = (await (
      await page.request.get("/content/en/manifest.json")
    ).json()) as { pages: { collection: string; slug: string }[] };
    const wikiPage = manifest.pages.find((p) => p.collection === "wikis/mtx");
    if (!wikiPage) throw new Error("no wiki page");
    await open(page, `/en/wikis/mtx/${wikiPage.slug}`);
    await expect(currentPane(page).getByRole("note")).toBeVisible();
  });

  test("the reading order ends where the shown books end", async ({ page }) => {
    // The synced manifest still lists the hidden books after the wikis.
    const manifest = (await (
      await page.request.get("/content/en/manifest.json")
    ).json()) as {
      collections: { slug: string; section: string; order: number }[];
      pages: { collection: string; slug: string; order: number }[];
    };
    const lastBook = manifest.collections
      .filter((c) => c.section !== "dev")
      .sort((a, b) => a.order - b.order)
      .at(-1);
    const lastPage = manifest.pages
      .filter((p) => p.collection === lastBook?.slug)
      .sort((a, b) => a.order - b.order)
      .at(-1);
    if (!lastBook || !lastPage) throw new Error("no last page");
    const url = `/en/${lastBook.slug}/${lastPage.slug}`;
    await open(page, url);
    await expect(
      currentPane(page).getByRole("link", { name: "Next" }),
    ).toHaveCount(0);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(url);
  });

  test("Develop shows only the notice, and its books lead back to it", async ({
    page,
  }) => {
    await page.goto("/en/dev");
    const main = page.locator("main");
    await expect(main.getByRole("note")).toContainText("Under construction");
    await expect(main.getByRole("link", { name: /Architecture/ })).toHaveCount(
      0,
    );
    // Also an outdated URL of one of its pages, found by the page's urlId.
    const manifest = (await (
      await page.request.get("/content/en/manifest.json")
    ).json()) as { pages: { collection: string; slug: string }[] };
    const hidden = manifest.pages.find((p) => p.collection === "architecture");
    if (!hidden) throw new Error("no developer page");
    const urlId = hidden.slug.split("-").at(-1);
    for (const url of [
      "/en/architecture",
      "/en/introduction/",
      "/en/dev/develop-deploy-app/api",
      `/en/architecture/${hidden.slug}`,
      `/en/deploy-app/an-old-title-${urlId}`,
    ]) {
      await page.goto(url);
      await expect(page).toHaveURL("/en/dev");
      await expect(main.getByRole("note")).toBeVisible();
    }
  });
});
