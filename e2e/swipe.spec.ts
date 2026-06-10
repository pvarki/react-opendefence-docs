import { expect, test, type Page } from "@playwright/test";

const FIRST = "/en/deploy-app/android-MENReFAfCN";
const SECOND = "/en/deploy-app/user-guide-SNTomIhnLe";
const THIRD = "/en/deploy-app/joining-a-deploy-app-p9htrbBL4S";

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
 * Horizontal drag in the title zone below the header (outside the 32px edge
 * dead zones, above any slideset deck, which rightly owns its own gestures).
 * Embla listens to pointer events, so a mouse drag exercises the same
 * gesture path as touch.
 */
async function swipe(page: Page, direction: "left" | "right") {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  const y = 110;
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
        name: "User Guide",
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
      currentPane(page).getByRole("heading", { name: "Android", exact: true }),
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

  test("vertical scrolling does not turn the page", async ({ page }) => {
    await open(page, THIRD); // long page (slideset with 4 steps)
    const scroller = page.locator("[data-current] [data-page-scroll]");
    await scroller.hover();
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(THIRD);
    await expect
      .poll(() => scroller.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
  });

  // Desktop-only: gesture ownership belongs to the desktop SlideDeck
  // (data-swipe-scope); the mobile step list intentionally has no scope.
  test("drags starting inside a slideset do not turn the page", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile",
      "StepList has no swipe scope",
    );
    await open(page, THIRD); // contains a slideset
    const scope = page.locator("[data-current] [data-swipe-scope]").first();
    await scope.scrollIntoViewIfNeeded();
    const box = await scope.boundingBox();
    if (!box) throw new Error("slideset not visible");
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.8, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    // The deck owns the gesture: it advances a slide (?slide=2 deep link)
    // while the page itself does not turn.
    await expect(page).toHaveURL(`${THIRD}?slide=2`);
  });

  test("edge gestures are ignored (dead zone)", async ({ page }) => {
    await open(page, SECOND);
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("no viewport");
    const y = viewport.height / 2;
    await page.mouse.move(10, y); // inside the 32px dead zone
    await page.mouse.down();
    await page.mouse.move(viewport.width * 0.7, y, { steps: 8 });
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

test.describe("locale fallback", () => {
  test("untranslated page shows English content with a banner", async ({
    page,
  }) => {
    await page.goto("/fi/deploy-app/android-MENReFAfCN");
    await expect(
      page
        .locator("[data-current]")
        .getByRole("heading", { name: "Android", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Tätä sivua ei ole vielä suomennettu", { exact: false }),
    ).toBeVisible();
  });

  test("contents drawer opens the book TOC on mobile", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile-only affordance");
    await page.goto(FIRST);
    await page.getByRole("button", { name: "Contents" }).click();
    // The Android group auto-opens because it contains the current page.
    await page.getByRole("link", { name: "Joining a Deploy App" }).click();
    await expect(page).toHaveURL(THIRD);
  });

  test("desktop sidebar shows the book tree with active page", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only affordance");
    await page.goto(SECOND);
    const sidebar = page.locator("aside");
    // The Android group auto-opens because it contains the current page.
    await expect(
      sidebar.getByRole("link", { name: "User Guide", exact: true }),
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
