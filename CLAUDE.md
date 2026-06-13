# CLAUDE.md

Guidance for AI agents working in this repo (docs.opendefence.fi — the
documentation reader for Deploy App, TAK, Matrix and related products).

## Project shape

- React 19 + Vite 7 + Tailwind v4. **Do not introduce Next.js.**
- Content is **authored in Outline** (pvarki.getoutline.com) and **pulled** into
  the repo as static JSON by the sync pipeline — never edit `public/content/`
  by hand. Commands: `pnpm sync` (incremental) / `pnpm sync:force`.
- Guides render as picture-and-text "slidesets": desktop slide deck, mobile step
  list. The authoring contract is the canonical `META: slides` format — see
  [docs/authoring/02-write-a-step-guide.md](docs/authoring/02-write-a-step-guide.md)
  and the structure/marker reference in [docs/authoring/](docs/authoring/).
- Before touching anything LLM/Claude/Anthropic-related, follow the `claude-api`
  skill trigger and check `~/.claude` memory for locked decisions.

## Writing product guides → use the Claude → Outline authoring loop

When a user asks you to **create, write, or publish step-by-step product guides**
(for Deploy App, TAK clients, Matrix, etc.), do NOT hand-author in the Outline
UI and do NOT hand-write `public/content/` JSON. Use the built loop:

```
pnpm author:scaffold <product> <platform> <slug> <stepCount> [--title "..."]
#   → drafts/<product>/<platform>/<slug>/{guide.md, hints.txt}
#   ("_" platform = platform-agnostic book, e.g. matrix)

# Then: the USER supplies ordered screenshots (NN-screenshot.png) + one-line
# hints; YOU write the step titles/captions into guide.md (canonical META: slides).

pnpm author:push drafts/<product>/<platform>/<slug> --dry-run   # preview, no writes
pnpm author:push drafts/<product>/<platform>/<slug>             # → UNPUBLISHED Outline draft
#   flags: --chapter "Title" (nest under a chapter organizer), --publish
# Then user publishes in Outline; `pnpm sync` pulls it into the app.
```

What `author:push` does: uploads each local screenshot to Outline as an
attachment (presigned S3 via `attachments.create`), rewrites the image links to
the hosted `attachments.redirect?id=…` URLs, and create-or-updates the leaf page
under the correct platform organizer (idempotent by title). Default is an
**unpublished** draft so nothing reaches the live site until the user publishes.

Key facts for agents:

- **You cannot screenshot the products yourself** — TAK/Matrix/Deploy App are
  native or login-gated apps with no agent access. Screenshots are always the
  user's input. Ask for them + a one-line hint per shot (exact button labels,
  off-screen steps); that is what keeps captions accurate.
- Collection IDs and per-platform **organizer document IDs** live in
  [scripts/author/products.ts](scripts/author/products.ts) — extend that map for
  new products/platforms/locales rather than hardcoding UUIDs elsewhere.
- The Outline API client is [scripts/lib/outline-api.ts](scripts/lib/outline-api.ts)
  (`uploadAttachment`, `createDocument`, `updateDocument`, `moveDocument`,
  `listDocuments`, `getDocumentText`). It needs `OUTLINE_API_KEY` from `.env`;
  any script using it must `import "dotenv/config"` first.
- Full workflow doc: [docs/authoring/06-claude-draft-to-outline.md](docs/authoring/06-claude-draft-to-outline.md).
- `drafts/` is local working material; screenshot binaries are git-ignored.

## Checks before pushing code

`pnpm typecheck` · `pnpm lint` · `pnpm test`. The user opens and merges their own
PRs — push to the active feature branch, don't create PRs for them.
