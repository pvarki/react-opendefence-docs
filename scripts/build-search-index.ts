/**
 * Build the pagefind search index over the emitted content JSON.
 *
 * M5 implements this with the pagefind Node API (per-locale languages,
 * Finnish/Swedish stemming). Until then it is a no-op so `pnpm build`
 * (which runs it via prebuild) stays green.
 */
console.log(
  "[build-search-index] pagefind indexing not implemented yet (M5) — skipping",
);
