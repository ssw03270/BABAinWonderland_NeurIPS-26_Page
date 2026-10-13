# Baba in Wonderland — project page

A static project page for [Baba in Wonderland](https://arxiv.org/abs/2605.16725), including thirteen small playable puzzles, saved Python world models, and fixed failure/resolution examples. All game files live in this repository.

Project page: <https://ssw03270.github.io/BABAinWonderland_NeurIPS-26_Page/>.

## Preview

From this directory, run:

```sh
python serve.py --port 8765
```

Open <http://127.0.0.1:8765/#play>. This command uses only the Python standard library to serve static files; any other static HTTP server also works. Opening `index.html` directly with `file://` is not supported because the page loads a worker and data files.

Visitors do **not** need Python, the research checkout, a Downloads folder, an API key, or a backend service. [Pyodide 0.27.7](https://pyodide.org/en/0.27.7/) runs the original Python simulator and saved programs inside a Web Worker. Its Python runtime, NumPy, PyYAML, and OpenCV load from the version-pinned jsDelivr CDN, so the first visit requires an internet connection and a short loading period. The article and fixed comparisons can appear before the interactive runtime is ready. Game states and program execution stay in the visitor's browser; there are no LLM calls or live training.

## Files

| Path | Contents |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Article, figures, controls, sprite rendering, and code viewer |
| [`programs/default/`](programs/default/) | 22 original saved programs, `v000.py`–`v021.py` |
| [`programs/wonderland/`](programs/wonderland/) | 51 original saved programs, `v000.py`–`v050.py` |
| `data/maps/*.json` | The 13 puzzles: layout, short objective, verified solution; the menu order is `MAP_IDS` in `runtime/game.py` |
| `data/aliases.json` | Wonderland property vocabulary from the experiment configuration |
| `data/examples.json` | Original simulator outputs used for the two fixed comparisons |
| `assets/` | Original game sprites (as boiling sprite sheets), the method clips and result cards rendered from the promo video's code, the ALFWorld clip, and the video thumbnail |
| `runtime/game.py` | Map/session management and one-step prediction comparison |
| `runtime/vendor/` | Required simulator, serialization, and sandbox modules from the research repository |
| `runtime/wheels/` | Bundled Gym 0.25.2, gym-notices 0.0.8, and cloudpickle 3.1.1 wheels |
| `runtime/worker.js` | Browser Python initialization and message handling |
| `runtime/bundle.zip` | Prebuilt archive loaded by the worker |
| `runtime/provenance.json` | Original source commit, SHA-256 hashes, and documented adaptations |
| `tests/` | Original-runtime reference hashes and browser/native parity checks |

The 73 program files are byte-for-byte copies of the supplied versions. Their hashes are recorded in the provenance file. `.gitattributes` preserves file bytes across Git checkouts without automatic line-ending conversion. The supplied files have no run metadata, so they are not asserted to be the exact checkpoints underlying the paper's tables.

The simulator comes from research-code commit `d683cccc52902218b55e49521c9a84226a72789d`. Its game rules are unchanged. Three packaging adaptations are documented: two package initializers omit training-only imports, and the map loader reads this repository's `data/maps` directory. Dependency wheels retain their bundled license files.

## Interactive demonstration

The thirteen puzzles follow the order in which the original game introduces its ideas. Each plays the role of an original level, the mechanic it introduces, the loophole it closes or the ideas it combines, on a new and smaller layout. None copies an original layout, and none is a paper evaluation map. They keep the original artwork and game rules. Each map JSON contains its layout, a short objective and a verified `solution` action list. Both latest supplied models predict every step of every saved solution correctly; this is a demonstration, not a measure of general performance on new maps. Names and objectives avoid property words, because Wonderland shows other words for them.

| # | Map | The idea | Role of original level | Steps |
| --- | --- | --- | --- | --- |
| 1 | Down the Rabbit-Hole | Shove the rocks aside, then push WIN up to finish FLAG IS WIN | 1 *Baba Is You*: the tutorial | 17 |
| 2 | The Lovely Garden | No goal yet: take FLOWER IS STOP apart and rebuild it as FLOWER IS WIN | 2 *Where Do I Go?*, with 3 | 11 |
| 3 | The Pool of Tears | Too few rocks to cross the pool, so ROCK IS WIN | 4 *Out Of Reach*: the first sinking | 22 |
| 4 | Lobster Quadrille | WIN is pinned now: ram the ROCK IS PUSH column into CRAB IS DEFEAT | 5 *Still Out Of Reach*: closes 4's loophole | 21 |
| 5 | The Cheshire Cat | The lava rules are pinned, so add LAVA IS PUSH and shove the lava aside | 6 *Volcano* | 19 |
| 6 | The Croquet-Ground | Share the YOU of BABA IS YOU: the walls beside the flag step onto it | 7 *Off Limits* | 12 |
| 7 | The White Rabbit | FLAG IS MOVE: the flag walks out of the skull ring | 11 *Affection* | 13 |
| 8 | Hall of Doors | The flag is sealed: form TILE IS WIN while Baba stands on the rug | 13 *Brick Wall* | 12 |
| 9 | The Golden Key | One key, two rows of doors: the rock takes KEY IS PUSH AND OPEN | 14 *Lock* | 19 |
| 10 | Queen of Hearts | Deadly walls: one word makes WALL IS LOVE IS WIN | 16 *Locked In* | 10 |
| 11 | Who Stole the Tarts? | The winning push arms the robots, so an accomplice rock makes it from afar | 22 *Submerged Ruins* | 13 |
| 12 | The Mock Turtle | Float over the pool, then drown a word of BABA IS FLOAT to land on the flag | 24 *Float* | 9 |
| 13 | The Fish-Footman | A moving cog carries IS across the jellies | 35-36 *Research Facility*, *Wireless Connection* | 26 |

Play opens on **Down the Rabbit-Hole** at step zero in **Default World**, with the latest program `v021` (Wonderland: `v050`). The Map selector starts a new attempt on the chosen puzzle in the same world. Restart resets the selected map; undo never crosses map boundaries. Arrow keys/WASD move while the pointer is on the game (or after a click into it); Space stays, Z undoes, and R restarts. Above the source, every saved revision of the world is a square: green when it predicts the last move right, red when it does not. After each move (or undo, or world switch) the revision that last fixed the move (the first of the latest run of revisions that get it right) is picked before the squares sweep in; choosing a square picks that revision instead. The board shows the picked revision's prediction (the same as the game when it is right), named in its heading; where it is wrong, marks say how the game really is, with nothing drawn over anything: a cross on a thing the game does not have, a dashed frame where the game has a thing the prediction lacks, and a dashed frame with a pointer on a thing it turns the wrong way (the game turns a pushed thing to face the push). The heading names what it gets wrong, the thing that faces the wrong way, or the win it misses or predicts; WIN shows on the board only when the shown prediction wins. The source viewer shows the picked revision's diff against the previous saved revision (its added and removed line counts and the functions it changed or added, each a jump to it), or the complete original Python; Copy copies its complete source. Beside the controls, the newest moves that fit on one row are squares with their arrows, green or red by whether the picked revision predicts them right.

**Auto** resets the map to step zero and replays the selected map's recorded solution with a 250 ms pause between completed steps. This is a saved solution, not a policy generated by the selected model. A non-terminal prediction mismatch or model error pauses Auto before the next action. Red dashed outlines mark differing cells. Inspect or change the program, then **Continue** to acknowledge the mismatch and resume. **Stop** cancels future steps; an in-flight step may finish. Manual movement, Undo, or Restart leaves replay mode, so the next Auto starts from step zero. Playback also stops at a terminal state, the end of the recording, or an execution error.

Each prediction uses the actual pre-action state. Changing worlds or revisions re-predicts that same transition without advancing or resetting the game. Default World uses canonical property words; Wonderland uses remapped property words, mapped back only for display. Exact-state comparison includes object attributes and the terminal flag. These are one-step predictions, not accumulated model rollouts. Saved programs use the original restricted-builtins sandbox with a 1.5-second execution limit. `v000` returns None and displays a prediction error after a move. The page runs the research sandbox with a cheaper guard: its 1.5 s limit is checked at every function call rather than on every line (a per-line tracer made each prediction several times slower in the browser), and the line budget is not counted.

Above the game, two fixed Default World comparisons always use the first map: a wall bump on the first UP (`v002` fails, `v003` matches), and pushing a chain on the third RIGHT (`v002` fails, `v005` matches). Each plays as a short story in one picture (the move, the older version's prediction, the newer one's), drawn with the original sprites, which boil as in the game; the states do not change during play. These are illustrative replays, not evidence of historical training events on this map or full-benchmark accuracy. Revision numbers are run-specific, not aligned training steps or LLM-call counts.

## Updating and checking the package

After changing Python modules, programs, data, or parity fixtures, rebuild the browser archive:

```sh
python build_runtime.py
```

The build needs only the Python standard library and reads only this repository. Keep the generated `runtime/bundle.zip` with the source changes; the browser executes this archive. HTML, CSS, JavaScript, and asset-only edits do not require rebuilding it.

With the preview running, open <http://127.0.0.1:8765/tests/browser.html> and select **Run verification**. This runs in the same browser Python environment as the demo. It checks 580 comparisons against reference outputs: all thirteen solution traces in both worlds including their initial states, plus every saved version on both fixed comparison scenes. The first map's traces were independently checked against the original research checkout; the other twelve come from the bundled simulator, since the research checkout's simulator has since been refactored. It also checks all final wins, the two-rock push, rule-dependent victory, one mechanic per map at the step it happens (sinking, a key and door opening, a transformation, landing from a float), map switching, the fixed comparison images, undo, all 73 original program hashes, and that simulator imports come only from the bundled modules.

For an optional native Python check in an environment with NumPy, PyYAML, OpenCV, and the bundled wheel dependencies installed:

```sh
python -B tests/verify_runtime.py
```

## GitHub Pages

The repository is served directly as a [GitHub Pages static site](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), configured with **Settings → Pages → Deploy from a branch → main / (root)**. Publish updates by pushing the complete file tree and current prebuilt archive to `main`. `.nojekyll` preserves the Python package files. No backend, build workflow, or secret is required. Asset and worker paths are relative, including under `/BABAinWonderland_NeurIPS-26_Page/`.

The today/total badge beside the footer's title comes from [hits.sh](https://hits.sh), which counts every load of the page, refreshes and local previews included. Its daily numbers are at [hits.sh/ssw03270.github.io/BABAinWonderland_NeurIPS-26_Page/](https://hits.sh/ssw03270.github.io/BABAinWonderland_NeurIPS-26_Page/). If hits.sh is unreachable or blocked, the badge removes itself.

## Sources and attribution

- [Paper](https://arxiv.org/abs/2605.16725) and the supplied manuscript/figures.
- [Research code](https://github.com/ssw03270/BABAinWonderland_NeurIPS-26).
- [Original Baba Is You on Steam](https://store.steampowered.com/app/736260/Baba_Is_You/).

Figures are rendered from the supplied original PDFs. Results are one-step state prediction accuracies, with online and held-out fixed-data evaluation separate. No conference acceptance claim is included.

The original Baba Is You game assets and level/map data are credited to the original game. We obtained permission from the game's developer to use these assets and map data for this research package. This repository does not grant separate rights to reuse the original game assets or map data outside the permitted research context; preserve this attribution and usage notice when sharing derived packages.

Questions about the paper or code: [SeungWon Seo](mailto:ssw03270@korea.ac.kr).
