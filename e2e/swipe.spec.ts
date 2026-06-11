import { expect, test, type Page } from "@playwright/test";

// Real synced content: deploy-app, android platform, User Guide chapter.
const FIRST = "/en/deploy-app/joining-a-deploy-app-p9htrbBL4S";
const SECOND = "/en/deploy-app/using-applications-CsobZMZ45Q";
const THIRD = "/en/deploy-app/interface-4Ncp4affe9";
const ADMIN_FIRST = "/en/deploy-app/first-login-qwmPnmJsrF";

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

/**
 * Horizontal drag in the title zone just below the header (outside the 32px
 * edge dead zones, above the slideset deck, which rightly owns its own
 * gestures). Embla listens to pointer events, so a mouse drag exercises the
 * same gesture path as touch.
 */
async function swipe(page: Page, direction: "left" | "right") {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  const y = 80;
  const from =
    direction === "left" ? viewport.width * 0.8 : viewport.width * 0.2;
  const to = direction === "left" ? viewport.width * 0.2 : viewport.width * 0.8;
  await page.mouse.move(from, y);
  await page.mouse.down();
  await page.mouse.move(to, y, { steps: 8 });
  await page.mouse.up();
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
    await open(page, FIRST);
    await swipe(page, "right");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(FIRST);
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
    if (testInfo.project.name === "desktop") {
      // Desktop deck binds the ?slide deep link.
      await expect(page).toHaveURL(`${FIRST}?slide=2`);
    } else {
      // Mobile show advances internally; the page never turns.
      await expect(page).toHaveURL(FIRST);
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

test.describe("contextual bottom bar (mobile)", () => {
  test("shows the book's chapters; tapping jumps to the chapter", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "bottom bar is mobile-only");
    await open(page, FIRST);
    const bar = page.locator("nav.fixed");
    await expect(bar.getByRole("button", { name: "User Guide" })).toBeVisible();
    await bar.getByRole("button", { name: "Admin Guide" }).click();
    await expect(page).toHaveURL(ADMIN_FIRST);
    // Active chapter chip follows.
    await expect(
      bar.getByRole("button", { name: "Admin Guide" }),
    ).toHaveAttribute("aria-current", "true");
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

  test("TAK guide labels platforms by client name", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "asserts navbar selector");
    await page.goto("/en/guides/tak-guide");
    const selector = page.getByRole("combobox", { name: "Platform" });
    await selector.click();
    await expect(page.getByRole("option", { name: "ATAK" })).toBeVisible();
    await expect(page.getByRole("option", { name: "iTAK" })).toBeVisible();
    await page.getByRole("option", { name: "WinTAK" }).click();
    // Cover now lists the WinTAK reading order.
    await expect(
      page.locator("main").getByText("WinTAK", { exact: false }).first(),
    ).toBeVisible();
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
      page.getByText("Tätä sivua ei ole vielä suomennettu", { exact: false }),
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
    await expect(page).toHaveURL(/\/en\/(deploy-app|guides|wikis|dev)\//);
  });
});
