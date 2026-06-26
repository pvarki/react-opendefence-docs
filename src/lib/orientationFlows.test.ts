import { describe, expect, it } from "vitest";
import en from "../locales/en.json";
import {
  FLOWS,
  SELECTOR,
  type Question,
  type TrackKey,
} from "./orientationFlows";

// Collections the reader can route to (the splat prefix must be one of these).
const KNOWN_COLLECTIONS = new Set([
  "introduction",
  "contribute-to-project",
  "develop-deploy-app",
  "build-an-integration",
  "operate",
  "working-with-tak",
]);

function resolve(key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (o, k) =>
        o && typeof o === "object"
          ? (o as Record<string, unknown>)[k]
          : undefined,
      en,
    );
}

function questionKeys(q: Question): string[] {
  const keys = [q.promptKey, ...(q.leadKey ? [q.leadKey] : [])];
  for (const o of q.options) {
    keys.push(o.key);
    if (o.bodyKey) keys.push(o.bodyKey);
  }
  return keys;
}

const tracks = Object.keys(FLOWS) as TrackKey[];

describe("orientation flows", () => {
  it("references only i18n keys that exist in en.json", () => {
    // Keys the component reads directly, beyond the question config.
    const keys = new Set<string>([
      "orient.back",
      "orient.continue",
      "orient.confirm",
      "orient.revisit",
      "orient.selector.title",
      "orient.selector.transition",
      ...questionKeys(SELECTOR),
    ]);
    for (const track of tracks) {
      keys.add(`orient.${track}.title`);
      keys.add(`orient.${track}.lead`);
      for (const q of FLOWS[track])
        for (const k of questionKeys(q)) keys.add(k);
    }
    for (const k of keys) {
      expect(typeof resolve(k), `missing en.json key: ${k}`).toBe("string");
    }
  });

  it("ends each track in link options, with info options before", () => {
    for (const track of tracks) {
      const flow = FLOWS[track];
      const last = flow[flow.length - 1];
      for (const o of last.options) {
        expect(
          o.target,
          `${track} final option ${o.key} must link`,
        ).toBeDefined();
        expect(o.bodyKey).toBeUndefined();
      }
      for (const q of flow.slice(0, -1)) {
        for (const o of q.options) {
          expect(
            o.bodyKey,
            `${track} option ${o.key} must reveal info`,
          ).toBeDefined();
          expect(o.target).toBeUndefined();
        }
      }
    }
  });

  it("points every link at a known collection or the dev shelf", () => {
    for (const track of tracks) {
      for (const q of FLOWS[track]) {
        for (const o of q.options) {
          if (!o.target) continue;
          if (o.target.splat) {
            const collection = o.target.splat.split("/")[0];
            expect(
              KNOWN_COLLECTIONS.has(collection),
              `unknown collection: ${collection}`,
            ).toBe(true);
          } else {
            expect(o.target.to).toBe("/$locale/dev");
          }
        }
      }
    }
  });

  it("offers three tracks plus a skip in the selector", () => {
    expect(
      SELECTOR.options
        .filter((o) => o.track)
        .map((o) => o.track)
        .sort(),
    ).toEqual(["contribute", "integrate", "operate"]);
    expect(SELECTOR.options.filter((o) => o.close)).toHaveLength(1);
  });
});
