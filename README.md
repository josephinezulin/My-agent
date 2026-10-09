# Block Out (HTML)

A browser version of a "Block Out" color sort puzzle: drag colored blocks across
the board and slide each one out through the gate of the same color.

## Play

- Drag a block to move it; blocks cannot pass through each other.
- A block leaves the board when it touches a gate of its color that is wide enough for it.
- Clear every block to finish the level. Undo (Ctrl+Z), restart and level select are in the toolbar.
- Progress and best move counts are saved in the browser (localStorage).

## Project layout

| Path | Purpose |
| --- | --- |
| site/index.html | The game (HTML, CSS, JS in one file) |
| site/levels.js | Generated level data (20 levels) |
| tools/generate-levels.js | Level generator; every level is checked by a solver to be clearable |
| .github/workflows/pages.yml | Deploys `site/` to GitHub Pages |

Run locally: open `site/index.html` in a browser.

Regenerate levels:

```
node tools/generate-levels.js > site/levels.js
```

## Deployment (GitHub Pages via Actions)

1. Repository Settings > Pages > Build and deployment > Source: **GitHub Actions**.
2. Push to `main` (or run the workflow manually from the Actions tab).
3. The site is published at `https://<owner>.github.io/<repo>/`.
