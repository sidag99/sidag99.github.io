# sidag99.github.io

Personal site and lab of Siddharth Agarwal — full-stack engineer (Java, TypeScript, Vue.js) working on applied and agentic AI. Served by GitHub Pages at https://sidag99.github.io

Static files, no build step and no backend:

- `index.html` — content: experience, the Code Mode project, playground cards, about, contact.
- `style.css` — light and dark themes, responsive layout, reduced-motion support.
- `js/app.js` — page interactions: experiment dialogs and quick navigation (Cmd/Ctrl K).
- `js/engine.mjs` — pure logic for the demos and games, testable in Node.
- `tests/engine.test.mjs` — tests for the bots, pathfinding, request model, Code Mode demo and assistant.
- `assets/Resume_Siddharth_Agarwal.pdf` — downloadable résumé.
- `assets/fonts/` — self-hosted fonts (SIL Open Font License), so the site makes no third-party requests.
- `assets/og-image.png` — link-preview image for LinkedIn and other sites.

## Demos

The Code Mode project section opens **Code Mode on toy data**: the idea from the Black Forest Hackathon project, run against generated data in the browser.

The playground has five experiments:

1. **Connect Four** — depth-limited minimax with alpha-beta pruning that shows its score for every column, with hints and undo.
2. **Tic-tac-toe** — exhaustive minimax, with hints, outcome overlays and undo.
3. **Pathfinding** — draw a maze and compare breadth-first search with A*.
4. **Request simulator** — sequential, parallel and batched requests on a timeline (an illustrative model).
5. **Guided assistant** — prepared answers from the résumé; not a language model, nothing leaves the page.

The demos and games were built for this portfolio with help from AI coding assistants.

## Run locally

```sh
python3 -m http.server 4173
npm test
```

Tests need Node.js 18+ and no dependencies.
