# docs.opendefence.fi

Documentation site for Deploy App and the OpenDefence stack. Content is
authored in [Outline](https://pvarki.getoutline.com), synced into this repo as
structured JSON, and served as an installable, offline-capable PWA with
book-like swipe navigation.

Built with React 19, Vite, Tailwind CSS v4, TanStack Router and Embla.
Deployed to GitHub Pages (docs.opendefence.fi) and published as an nginx
Docker image for air-gapped Deploy App stacks.

## Who is this for?

1. **Deploy App users** (soldiers, any rank) — guides for using Deploy App and
   integrated products (TAK, MTX, Matrix, CryptPad) in the field.
2. **Developers & operators** — stack internals, integration guides, API
   reference, deployment runbooks.
3. **Guide authors** — write docs in Outline; the site syncs and publishes
   them automatically. See the "Writing docs" pages on the site itself.

## Development

Requirements: Node 22+, pnpm 10+ (`corepack enable`).

```bash
pnpm install
pnpm dev          # http://localhost:5173 (fixture content is committed)
pnpm build        # production build (vite build + typecheck)
pnpm preview      # serve the production build
pnpm test         # unit tests (vitest)
pnpm lint         # eslint
```

Install the git hooks once per clone (pre-commit framework, org config):

```bash
uvx pre-commit install --install-hooks
```

## Content sync

Content lives under `public/content/` (committed, generated — do not edit by
hand; edit in Outline instead). The sync pipeline needs an Outline **admin**
API key:

```bash
export OUTLINE_API_KEY=...
export OUTLINE_API_BASE=https://pvarki.getoutline.com/api
pnpm sync         # incremental sync + translations + api specs + validation
pnpm sync:force   # full re-download
```

In CI, `scheduled-sync.yml` runs weekly (Saturday night) and opens a PR on
branch `docs/outline-sync` with a validation report; merging it deploys.

Collections are registered in [config/collections.ts](config/collections.ts).

## Architecture

```
config/            collection registry + external doc links
scripts/           Outline sync pipeline (tsx; no app imports)
shared/            zod content schemas shared by scripts/ and src/
public/content/    generated content JSON + images (committed)
public/api-specs/  fetched OpenAPI specs for the Scalar reference (committed)
src/routes/        TanStack Router file-based routes
src/components/    ui/ (vendored shadcn) shell/ reader/ slides/ blocks/ search/
```

Versioning and changelog are managed by release-please (conventional
commits); the Docker image is published by
[config-ci-library](https://github.com/pvarki/config-ci-library) `publish-image`
on each release.
