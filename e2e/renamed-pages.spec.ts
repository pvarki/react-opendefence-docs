import { expect, test } from "@playwright/test";

// Onboarding modals aria-hide the page behind them.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("od-intro-seen-v1", "1");
    localStorage.setItem("od-orient-seen-v1", "1");
  });
});

/** A guide page from the synced manifest: new syncs move pages around. */
async function guidePage(page: import("@playwright/test").Page) {
  const response = await page.request.get("/content/en/manifest.json");
  const manifest = (await response.json()) as {
    pages: { collection: string; slug: string }[];
  };
  const found = manifest.pages.find((p) => p.collection.startsWith("guides/"));
  if (!found) throw new Error("no guide page in the manifest");
  return found;
}

test("an old title in the URL redirects to the page's current URL", async ({
  page,
}) => {
  const { collection, slug } = await guidePage(page);
  const urlId = slug.slice(slug.lastIndexOf("-") + 1);
  await page.goto(`/en/${collection}/an-old-title-${urlId}?slide=2`);
  await expect(page).toHaveURL(`/en/${collection}/${slug}?slide=2`);
  await expect(page.locator("[data-current]")).toHaveCount(1);
});

test("a page linked under the wrong book redirects to its own book", async ({
  page,
}) => {
  const { collection, slug } = await guidePage(page);
  await page.goto(`/en/deploy-app/${slug}`);
  await expect(page).toHaveURL(`/en/${collection}/${slug}`);
});

test("an unknown urlId still shows Page not found", async ({ page }) => {
  await page.goto("/en/deploy-app/no-such-page-ZZZZZZZZZZ");
  await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();
});
