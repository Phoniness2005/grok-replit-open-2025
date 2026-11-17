# The Power of 10 in this repository

This site is a browser Pong game: HTML, CSS, and JavaScript, served as static files by GitHub Pages. The game code follows Gerard J. Holzmann’s “The Power of 10: Rules for Developing Safety-Critical Code” (IEEE Computer, June 2006), adapted to those languages. The rules below are the project’s reading of that paper. The paper itself is the source of the wording; this file does not reproduce it.

The shipped game is `shared/power10.js`, `v1/game.js`, and `v2/game.js`, loaded by `v1/index.html` and `v2/index.html`. `index.html` is the hub and has no script. Gameplay, colours, court geometry, and the public page URLs are unchanged.

## Compliance

| Rule | Status | What it means here | Files |
|---|---|---|---|
| 1. Simple control flow, no recursion | compliant | Straight-line code, `if`, and `for` only. No `goto`, `with`, `eval`, or function that calls itself directly or through another game function. `tools/check-power10.mjs` builds a call graph and rejects a cycle. | `shared/power10.js`, `v1/game.js`, `v2/game.js` |
| 2. Fixed upper bound on every loop | adapted | Every `for` loop tests `i < CONSTANT` or `i <= CONSTANT` and steps by 1. `while`, `do`, `for-in`, and `for-of` are ESLint errors in the game. The frame pump cannot be given a static trip count; see the exceptions. Work inside one frame stays inside those caps (collision substeps, AI prediction, crowd, net, trail, touch). | `v1/game.js`, `v2/game.js`, `eslint.config.js` |
| 3. No dynamic allocation after initialization | adapted | Menus, help, and HUD nodes are in the HTML. Trail points, crowd colours, dash lists, and canvas gradients are allocated once and reused. Gradients are drawn under a translation so a moving ball does not build a new gradient. Per-frame paths do not create arrays or objects. The exceptions below are the cases the platform does not allow us to avoid. | `v1/index.html`, `v2/index.html`, `v1/game.js`, `v2/game.js` |
| 4. Functions stay at or under about 60 lines | compliant | ESLint `max-lines-per-function` is 60, ignoring blank lines and comments. | `v1/game.js`, `v2/game.js`, `shared/power10.js`, `tools/check-power10.mjs`, `eslint.config.js` |
| 5. At least two assertions per function, with recovery | compliant | `assertThat` returns a boolean and does not mutate state. Every other game function calls it at least twice. A failed check clamps a value, resets the ball or the match, or bails before the frame loop starts. Density on the last run: v1, 70 functions, 142 assertions, average 2.03; v2, 88 functions, 178 assertions, average 2.02. | `shared/power10.js`, `v1/game.js`, `v2/game.js`, `tools/check-power10.mjs` |
| 6. Smallest practical scope | compliant | `const` and `let` only. Each game file is an ES module (`<script type="module">`), so match state is not a property of `window`. Locals stay inside the function that uses them. | `v1/index.html`, `v2/index.html`, `v1/game.js`, `v2/game.js` |
| 7. Check return values and parameters | compliant | `getElementById`, `getContext`, `getBoundingClientRect`, audio-node creation, `requestAnimationFrame`, and numeric parameters are checked. Missing markup writes a short message and does not start the loop. | `v1/game.js`, `v2/game.js` |
| 8. No dynamic code generation | compliant | No `eval`, `new Function`, `innerHTML`, `outerHTML`, or `document.write`. Overlay and menu copy is real HTML. | `v1/game.js`, `v2/game.js`, `v1/index.html`, `v2/index.html`, `index.html` |
| 9. Restrict indirection | adapted | No `obj[name]()` dispatch. Difficulty, menus, and keys use direct `if` tests. The browser still requires a function reference for events and animation frames; each callback has a name and is listed below. | `v1/game.js`, `v2/game.js`, `eslint.config.js` |
| 10. Zero warnings from the analysers | compliant | `npm run lint` is ESLint with `--max-warnings 0`, html-validate on the recommended preset, and the Power of 10 script. GitHub Actions runs that on `push` and `pull_request`. | `.github/workflows/lint.yml`, `eslint.config.js`, `.htmlvalidate.json`, `package.json` |

## Documented exceptions

**Frame pump (rules 2 and 9).** `onFrame` in `v1/game.js` and `v2/game.js` is passed to `requestAnimationFrame`. The browser invokes it; the function does not call itself. The page cannot prove how many frames will be painted. Each invocation returns after a bounded amount of work.

**Other named browser callbacks (rule 9).** These are passed to `addEventListener` or, where noted, to `requestAnimationFrame`:

- Version 1: `onKeyDown`, `onKeyUp`, `onMouseMove`, `onTouchStart`, `onTouchMove`, `onUiClick`.
- Version 2: `onKeyDown`, `onKeyUp`, `onMouseMove`, `onTouchStart`, `onTouchMove`, `onUpPointerDown`, `onUpPointerUp`, `onDownPointerDown`, `onDownPointerUp`, `onPauseClick`, `onFullScreenClick`, `onOverlayClick`, `onFitCourt`, `onAssetLoad`, `onAssetError`. `onFitCourt` is also scheduled once with `requestAnimationFrame` after load and after the full-screen button.

**Web Audio nodes (rule 3).** `AudioContext` is created once, on the first beep. Each beep still constructs an `OscillatorNode` (and, in version 2, a `GainNode`) because a stopped oscillator cannot be started again. Version 1 previously constructed a new `AudioContext` per beep; it now uses one context and the same square-wave frequency and duration. Version 2 still uses a gain of `0.035`.

**Text and layout strings (rule 3).** Score, stats, and help text are written when the values change, not on every frame. `onFitCourt` sets court `style.width` and `style.height` on resize, full screen, and once at startup.

**Startup images (rule 3).** Version 2 still decodes `grass.jpg`, `wood-light.jpg`, `wood-dark.jpg`, and `seats.jpg` after the document loads, then builds two `CanvasPattern`s. That matches the original load. The asset prefix is still `assets/`, or `/wp-content/themes/dabbuilds-child/play/v2/assets/` when the path starts with `/play/`.

**Version 1 timers (rule 3).** Cheer, the post-win pause, and the game-over return use deadlines read from `performance.now()` inside the frame (1000 ms, 2000 ms, and 5000 ms). The cheer deadline is the earliest pending one, which is the same visible result as the original stacked `setTimeout` calls. No closure is allocated per point.

**Assertion facility (rule 5).** `assertThat` in `shared/power10.js` is the check itself. It only reads `typeof` and `===`, and it is excluded from the density count the way a C `assert` macro is not asked to assert itself.

## Third-party code

The game vendors no third-party JavaScript. Browser APIs (DOM, Canvas, Web Audio, `requestAnimationFrame`) are the platform and are not rewritten.

These development and CI dependencies are exempt from the game rules. They are not referenced by the pages GitHub Pages serves:

- npm: `eslint`, `@eslint/js`, `html-validate`, `globals`, `acorn`
- Actions, pinned to full commit SHAs: `actions/checkout` v7.0.1 (`3d3c42e5aac5ba805825da76410c181273ba90b1`), `actions/setup-node` v7.1.0 (`949feb2413d6458794dcd2491c4babbbce0c15c1`), `github/codeql-action` v4.39.3 (`33d7b85da1a04171e211befe2c739303b9a4c066`) for init, autobuild, and analyze

`tools/check-power10.mjs` is the development checker. It is lint-clean and does not use `eval`. Its syntax walk uses an explicit stack capped at 200000 nodes. ESLint’s ban on `while` applies to the game files, not to this tool.

## Checks

```bash
npm ci
npm run lint
```

`npm run lint` runs ESLint (`--max-warnings 0`), html-validate on `index.html`, `v1/index.html`, and `v2/index.html`, and `node tools/check-power10.mjs`.

The lint workflow uses `push` and `pull_request` only, with `permissions: contents: read`. It does not use `pull_request_target`. The existing GitHub Pages deployment is the repository’s dynamic `pages-build-deployment` workflow and is unchanged.

CodeQL (`.github/workflows/codeql.yml`) analyses `javascript-typescript`, the only CodeQL language present. HTML and CSS are not CodeQL languages. The workflow-level permission is `contents: read`. The analyze job also sets `security-events: write` so the SARIF result can be uploaded, and `actions: read` for the CodeQL action. Dependabot (`.github/dependabot.yml`) tracks the `github-actions` and `npm` ecosystems, which are the only package ecosystems in the repo.

## Playing a change before it is merged

GitHub Pages keeps serving the default branch until this change is merged. From a checkout of the branch:

```bash
python3 -m http.server 8766
```

Open `http://127.0.0.1:8766/`, then version 1 and version 2. Version 2 images load from `v2/assets/`. On a phone-sized window, drag the court; Up, Down, and Pause are on screen. Full screen is the button under the court.
