/**
 * Type shim for sharp 0.35.0, whose package.json "exports" map lacks a
 * "types" condition — under moduleResolution "bundler" TypeScript resolves
 * "sharp" to dist/index.mjs and cannot see lib/index.d.ts (TS7016). The
 * relative import below bypasses the exports map and reuses the real
 * declarations. Delete this file once sharp ships a fixed exports map
 * (https://github.com/lovell/sharp — fixed in later 0.35.x releases).
 */
declare module "sharp" {
  import sharp = require("../../node_modules/sharp/lib/index");
  export = sharp;
}
