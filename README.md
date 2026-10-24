# sidag99.github.io

Personal site and lab of Siddharth Agarwal — full-stack engineer (Java, TypeScript, Vue.js) working on applied and agentic AI. Served by GitHub Pages at https://siddharth-agarwal.is-a.dev (the custom domain in `CNAME`; https://sidag99.github.io redirects there)

Static files, no build step and no backend:

- `index.html` — content: experience, the Code Mode project, playground cards, about, contact.
- `style.css` — light and dark themes, responsive layout, reduced-motion support. Dark mode follows the device until the visitor picks a theme with the sun/moon button; the choice is remembered, and a tiny script in the page head applies it before the first paint.
- `js/app.js` — page interactions: experiment dialogs and quick navigation (Cmd/Ctrl K).
- `js/engine.mjs` — pure logic for the demos and games, testable in Node.
- `js/i18n.mjs` — the German version of the page and the EN/DE switch. English lives in `index.html`; German text is matched to it by its English HTML. The page starts in German for German-language browsers, remembers the visitor's choice, and `?lang=de` or `?lang=en` forces a language.
- `tests/engine.test.mjs` — tests for the bots, pathfinding, request model, Code Mode demo and assistant.
- `assets/Resume_Siddharth_Agarwal.pdf` — downloadable résumé.
- `assets/fonts/` — self-hosted fonts (SIL Open Font License), so the site makes no third-party requests.
- `assets/og-image.png` — link-preview image for LinkedIn and other sites.

## Demos

The Code Mode project section opens **Code Mode on toy data**: the idea from the Black Forest Hackathon project, run against generated data in the browser.

The playground has four experiments:

1. **Request simulator** — sequential, parallel and batched requests on a timeline (an illustrative model).
2. **Two games, two kinds of bot** — tic-tac-toe with exhaustive minimax (solved: it checks every possible game) and Connect Four with depth-limited minimax and alpha-beta pruning (estimated: it shows its score for every column). Both have hints and undo.
3. **Pathfinding** — draw a maze and compare breadth-first search with A*.
4. **Guided assistant** — prepared answers from the résumé; not a language model, nothing leaves the page.

The demos and games were built for this portfolio with help from AI coding assistants.

## Run locally

```sh
python3 -m http.server 4173
npm test
```

Tests need Node.js 18+ and no dependencies.
