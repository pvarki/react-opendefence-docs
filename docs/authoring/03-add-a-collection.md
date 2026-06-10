# Add a collection

A collection is a book on the site. Adding one takes two steps:
create it in Outline, then register it in the repo with a small PR.

## 1. Create the collection in Outline

In [Outline](https://pvarki.getoutline.com), create a new collection.
Name it what readers should see, e.g. "Recon Guide".

## 2. Create the locale roots

Inside the collection, create three top-level documents titled
exactly:

```
en
fi
sv
```

These can be empty — they're wrappers. All your actual pages go
under them. If the collection will only ever exist in English, you
can skip this and set `noLocale: true` in step 4 instead.

## 3. Copy the collection UUID

Open the collection in Outline and copy the UUID from the URL or
the collection settings page. It looks like:

```
2ed45fcf-9424-4774-b5f9-9a66f7c1a009
```

## 4. Register it in config/collections.ts

Clone the repo, edit
[`config/collections.ts`](../../config/collections.ts), and add an
entry:

```ts
{
  collectionId: "2ed45fcf-9424-4774-b5f9-9a66f7c1a009",
  label: "Recon Guide",
  slug: "guides/recon-guide",
  section: "guides",
  description: "Recon platform guide",
},
```

Two choices to make:

- **section** — which tab the book lives under:
  `"deploy-app"`, `"guides"`, `"dev"`, or `"wikis"`.
- **slug** — the URL. A slug with `/` (`guides/recon-guide`,
  `wikis/recon`) groups the book on a shelf; a slug without `/`
  is a standalone book.

Add the entry to the matching array (`GUIDE_COLLECTIONS`,
`WIKI_COLLECTIONS`) — those are already spread into
`ALL_COLLECTIONS`. A standalone entry must be added to
`ALL_COLLECTIONS` yourself.

Optional: `noLocale: true` for collections without en/fi/sv roots
(everything is treated as English).

## 5. Open a PR

Commit the one-file change and open a PR against `main`. A duplicate
UUID, duplicate slug, or malformed UUID fails validation, so typos
get caught before merge.

## 6. Sync

After the PR merges, either:

- wait for the weekly sync (Saturday night), or
- trigger it now: GitHub → **Actions** → **Scheduled Outline Sync**
  → **Run workflow**. Put your slug (e.g. `guides/recon-guide`) in
  the _collection_ input to sync just your new book.

Or locally, with an Outline admin API key:

```bash
export OUTLINE_API_KEY=...
export OUTLINE_API_BASE=https://pvarki.getoutline.com/api
pnpm sync:outline
```

The sync opens its own PR with the content. Merging that PR deploys.
Details in [How sync works](04-how-sync-works.md).
