import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import fi from "@/locales/fi.json";
import sv from "@/locales/sv.json";
import { bookDescription } from "./bookDescription";

async function tFor(lng: string) {
  const i18n = createInstance();
  await i18n.init({
    resources: {
      en: { translation: en },
      fi: { translation: fi },
      sv: { translation: sv },
    },
    lng,
    fallbackLng: "en",
    showSupportNotice: false,
  });
  return i18n.t;
}

const takGuide = {
  slug: "guides/tak-guide",
  description: "Learn how to use TAK for situational awareness",
};

describe("bookDescription", () => {
  it("translates a book's description by its slug", async () => {
    expect(bookDescription(await tFor("fi"), takGuide)).toBe(
      fi.bookDescriptions.guides["tak-guide"],
    );
    expect(bookDescription(await tFor("sv"), takGuide)).toBe(
      sv.bookDescriptions.guides["tak-guide"],
    );
  });

  it("keeps the configured English text when no translation exists", async () => {
    expect(bookDescription(await tFor("en"), takGuide)).toBe(
      takGuide.description,
    );
    const devBook = { slug: "operate", description: "Deploy and run" };
    expect(bookDescription(await tFor("fi"), devBook)).toBe("Deploy and run");
  });

  it("returns nothing for a book without a description", async () => {
    expect(bookDescription(await tFor("fi"), { slug: "x" })).toBeUndefined();
  });
});
