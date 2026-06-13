# drafts/

Local working area for the Claude → Outline authoring loop. See
[docs/authoring/06-claude-draft-to-outline.md](../docs/authoring/06-claude-draft-to-outline.md)
for the full workflow.

Layout: `drafts/<product>/<platform>/<slug>/` (use `_` as the platform for a
platform-agnostic book). Each folder holds:

- `guide.md` — the canonical `META: slides` markdown (one `## ` per step).
- `hints.txt` — one line per screenshot; authoring notes, never published.
- `NN-screenshot.png` — your ordered screenshots (uploaded to Outline on push).

```
pnpm author:scaffold deploy-app android add-a-user 5 --title "Add a user"
# …add screenshots + hints, let Claude write guide.md…
pnpm author:push drafts/deploy-app/android/add-a-user --dry-run
pnpm author:push drafts/deploy-app/android/add-a-user      # unpublished draft in Outline
```

The `add-a-user` folder here is a starter scaffold — fill it in or delete it.
Screenshot binaries are git-ignored (they live in Outline after a push); the
`guide.md`/`hints.txt` text is kept so drafts stay reviewable in a PR.
