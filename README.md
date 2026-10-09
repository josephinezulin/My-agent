# Block Out (HTML)

A browser version of a "Block Out" color sort puzzle: drag colored blocks across
the board and slide each one out through the gate of the same color.

## Play

- Drag a block to move it; blocks cannot pass through each other.
- A block leaves the board when it touches a gate of its color that is wide enough for it.
- Clear every block to finish the level. Undo (Ctrl+Z), restart and level select are in the toolbar.
- Levels 1-20 are classic levels. Levels 21-50 are hard levels: stone cells block the board, the
  move limit equals the optimal number of drags (plus one on levels 21-25), and some blocks must be
  moved aside before others can leave.
- Stars: 3 for the optimal move count, 2 for up to 2 extra moves, 1 otherwise.
- Progress and best move counts are saved in the browser (localStorage).

## Project layout

| Path | Purpose |
| --- | --- |
| site/index.html | The game (HTML, CSS, JS in one file) |
| site/levels.js | Generated level data (50 levels) |
| tools/generate-levels.js | Level generator; an exact solver checks every level and sets its par and move limit |
| site/sultan/index.html | Sultan's Game: weekly orders, rites, side stories and multiple endings |
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
