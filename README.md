# Baba in Wonderland — project page

A static project page for [Baba in Wonderland](https://arxiv.org/abs/2605.16725), including eleven small playable puzzles, saved Python world models, and fixed failure/resolution examples. All game files live in this repository.

Project page: <https://ssw03270.github.io/BABAinWonderland_NeurIPS-26_Page/>.

## Preview

From this directory, run:

```sh
python serve.py --port 8765
```

Open <http://127.0.0.1:8765/#play>. This command uses only the Python standard library to serve static files; any other static HTTP server also works. Opening `index.html` directly with `file://` is not supported because the page loads a worker and data files.

Visitors do **not** need Python, the research checkout, a Downloads folder, an API key, or a backend service. [Pyodide 0.27.7](https://pyodide.org/en/0.27.7/) runs the original Python simulator and saved programs inside a Web Worker. Its Python runtime and NumPy load from the version-pinned jsDelivr CDN while the game files download beside them, so the first visit requires an internet connection and a short loading period. The article and fixed comparisons can appear before the interactive runtime is ready. Game states and program execution stay in the visitor's browser; there are no LLM calls or live training.

## Files

| Path | Contents |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Article, figures, controls, sprite rendering, and code viewer |
| [`programs/default/`](programs/default/) | 22 original saved programs, `v000.py`–`v021.py` |
| [`programs/wonderland/`](programs/wonderland/) | 52 saved programs, `v000.py`–`v051.py`, from the final Wonderland run `ours_rc035_u30`, seed 8801 |
| `data/maps/*.json` | The 11 puzzles: layout, short objective, verified solution; the menu order is `MAP_IDS` in `runtime/game.py` |
| `data/aliases.json` | Wonderland property vocabulary from the experiment configuration |
| `data/examples.json` | Original simulator outputs used for the two fixed comparisons |
| `assets/` | Original game sprites as boiling sheets, with the game's own variants: walls, water and lava joining their own kind and the map's edge, the facings of skulls, crabs and bolts (they start facing the viewer), characters' walking frames, and turning cogs; the method clips and result cards rendered from the promo video's code, the ALFWorld clip, and the video thumbnail |
| `runtime/game.py` | Map/session management and one-step prediction comparison |
| `runtime/vendor/` | Required simulator, serialization, and sandbox modules from the research repository |
| `runtime/wheels/` | Bundled Gym 0.25.2, gym-notices 0.0.8, and cloudpickle 3.1.1 wheels |
| `runtime/worker.js` | Browser Python initialization, message handling, and idle-time program preparation |
| `runtime/bundle.zip` | Prebuilt archive loaded by the worker |
| `runtime/provenance.json` | Original source commit, SHA-256 hashes, and documented adaptations |
| `tests/` | Original-runtime reference hashes and browser/native parity checks |

The 74 program files are byte-for-byte copies of saved versions. Their hashes are recorded in the provenance file. `.gitattributes` preserves file bytes across Git checkouts without automatic line-ending conversion. The 22 Default World programs are the originally supplied versions; they have no run metadata, so they are not asserted to be the exact checkpoints underlying the paper's tables. The 52 Wonderland programs are the complete version history of `ours_rc035_u30` seed 8801, one of the five final runs behind the paper's Wonderland results (`selected55_final_run_artifacts_20260731` in the research archive). Of the saved runs, its latest version predicts the most steps of the eleven puzzles' saved solutions (263 of 269).

The simulator comes from research-code commit `d683cccc52902218b55e49521c9a84226a72789d`. Its game rules are unchanged. Five files carry documented packaging adaptations: two package initializers omit training-only imports; the map loader reads this repository's `data/maps` directory and imports PyYAML only to read a map-split manifest, which the page does not use; and a rule block draws its label image when first rendered, importing OpenCV only to draw it. The page never renders images, so it loads neither PyYAML nor OpenCV. Dependency wheels retain their bundled license files.

## Interactive demonstration

The eleven puzzles follow the order in which the original game introduces its ideas, and each plays the role of an original level. Each is built around an assumption it overturns: the move a player first thinks of fails visibly, and the way through is one they did not expect to be allowed. None copies an original layout, and none is a paper evaluation map. They keep the original artwork and game rules. Each map JSON contains its layout, a short objective and a verified `solution` action list; for every puzzle, removing its key piece was checked exhaustively to leave it unsolvable. Names and objectives avoid property words, because Wonderland shows other words for them. The latest Default World program predicts every step of every saved solution. The latest Wonderland program misses the decisive move in five puzzles: the crabs vanishing, the jellies melting, BABA IS WIN, the last door opening itself, and the floating win. For four of these no saved Wonderland version is right, and the board shows the real game with the marks. This is a demonstration, not a measure of general performance on new maps.

| # | Map | The idea | Role of original level | Steps |
| --- | --- | --- | --- | --- |
| 1 | Down the Rabbit-Hole | Words are things: shove the rocks aside, then push WIN up to finish FLAG IS WIN | 1 *Baba Is You*: the tutorial | 17 |
| 2 | The Lovely Garden | No goal yet: take FLOWER IS STOP apart and rebuild it as FLOWER IS WIN, so the fence becomes the prize | 2 *Where Do I Go?*, with 3 | 11 |
| 3 | The Pool of Tears | One rock for a pool two cells deep: the rock opens the way to WATER IS SINK, and the WATER word drowns with its own rule | 4 *Out Of Reach*: the first sinking, with too few sinkers | 25 |
| 4 | Lobster Quadrille | CRAB IS DEFEAT will not budge, but BABA IS YOU lends its IS to a crossing CRAB IS YOU: crabs that are YOU and DEFEAT destroy themselves | 5 *Still Out Of Reach*: the first DEFEAT | 34 |
| 5 | The Cheshire Cat | The lava rules will not budge, so the jellies get Baba's weakness (JELLY AND BABA IS MELT) and are pushed into the lava | 6 *Volcano*: a hazard used, not removed | 33 |
| 6 | The White Rabbit | BABA IS MOVE as well as YOU: two cells a step, and a skull only bites where a step ends, so Baba leaps it | 11 *Affection*: MOVE | 15 |
| 7 | Caterpillar's Advice | The flag is sealed for good: BABA takes FLAG's place in its sentence, and BABA IS WIN | 13 *Brick Wall*: winning without reaching the goal | 33 |
| 8 | The Golden Key | One key, two doors: the key opens the first, then OPEN moves into DOOR IS _, and the last door opens itself | 14 *Lock*: one door more than keys | 31 |
| 9 | Queen of Hearts | Skulls fence Baba in: LOVE is borrowed for SKULL IS LOVE, the prison turns into hearts, and LOVE goes back to LOVE IS WIN | 16 *Locked In*: transformation | 28 |
| 10 | Who Stole the Tarts? | The winning push arms the robots, so an accomplice rock makes it from afar while Baba waits | 22 *Submerged Ruins*: a trap that fires as you win | 14 |
| 11 | The Mock Turtle | A floating Baba cannot touch the grounded flag: one FLOAT word at a crossing makes BABA IS FLOAT and FLAG IS FLOAT at once | 24 *Float* | 28 |

Play opens on **Down the Rabbit-Hole** at step zero in **Default World**, with the latest program `v021` (Wonderland: `v051`). The Map selector starts a new attempt on the chosen puzzle in the same world. Restart resets the selected map; undo never crosses map boundaries. Arrow keys/WASD move while the pointer is on the game (or after a click into it); Space stays, Z undoes, and R restarts. Above the source, every saved revision of the world is a square: green when it predicts the last move right, red when it does not. After each move (or undo, or world switch) the revision that last fixed the move (the first of the latest run of revisions that get it right) is picked before the squares sweep in; choosing a square picks that revision instead. When no revision gets the move right, the latest is picked and the board shows the game itself, with the same marks for what the revision gets wrong; a pill beside the verdict turns the board to that revision's guess and back. The board shows the picked revision's prediction (the same as the game when it is right), named in its heading; where it is wrong, marks say how the game really is, with nothing drawn over anything: a cross on a thing the game does not have, a dashed frame where the game has a thing the prediction lacks, and a dashed frame with a pointer on a thing it turns the wrong way (the game turns a pushed thing to face the push). The heading names what it gets wrong, the thing that faces the wrong way, or the win it misses or predicts; WIN shows on the board only when the shown prediction wins. The source viewer shows the picked revision's diff against the previous saved revision (its added and removed line counts and the functions it changed or added, each a jump to it), or the complete original Python; Copy copies its complete source. Beside the controls, the newest moves that fit on one row are squares with their arrows, green or red by whether the picked revision predicts them right.

**Auto** resets the map to step zero and replays the selected map's recorded solution with a 250 ms pause between completed steps. This is a saved solution, not a policy generated by the selected model. A non-terminal prediction mismatch or model error pauses Auto before the next action. Red dashed outlines mark differing cells. Inspect or change the program, then **Continue** to acknowledge the mismatch and resume. **Stop** cancels future steps; an in-flight step may finish. Manual movement, Undo, or Restart leaves replay mode, so the next Auto starts from step zero. Playback also stops at a terminal state, the end of the recording, or an execution error.

Each prediction uses the actual pre-action state. Changing worlds or revisions re-predicts that same transition without advancing or resetting the game. Default World uses canonical property words; Wonderland uses remapped property words, mapped back only for display. Exact-state comparison includes object attributes and the terminal flag. These are one-step predictions, not accumulated model rollouts. Saved programs use the original restricted-builtins sandbox with a 1.5-second execution limit. `v000` returns None and displays a prediction error after a move. The page runs the research sandbox with a cheaper guard: its 1.5 s limit is checked at every function call rather than on every line (a per-line tracer made each prediction several times slower in the browser), and the line budget is not counted. In the browser, Python 3.12's `sys.monitoring` runs the check as the programs' own functions start or resume and watches no other code; a call tracer would make them about twice as slow. The page also compiles each program straight from its source, which gives the same code object as the research sandbox's compile of the parsed syntax tree at about half the cost. A program is compiled, and its code view made, when first needed; the worker prepares the others while it is idle, the opening world's first, so the first board waits for none of them. Each move's verdicts are kept once computed, so the squares and the record of moves never run a version on the same move twice; only the shown prediction is run again, to draw it. A verdict is the research code's exact-state comparison, with the actual state's side of it prepared once per move.

Above the game, two fixed Default World comparisons always use the first map: a wall bump on the first UP (`v002` fails, `v003` matches), and pushing a chain on the third RIGHT (`v002` fails, `v005` matches). Each plays as a short story in one picture (the move, the older version's prediction, the newer one's), drawn with the original sprites, which boil as in the game; the states do not change during play. These are illustrative replays, not evidence of historical training events on this map or full-benchmark accuracy. Revision numbers are run-specific, not aligned training steps or LLM-call counts.

## Updating and checking the package

After changing Python modules, programs, data, or parity fixtures, rebuild the browser archive:

```sh
python build_runtime.py
```

The build needs only the Python standard library and reads only this repository. Keep the generated `runtime/bundle.zip` with the source changes; the browser executes this archive. HTML, CSS, JavaScript, and asset-only edits do not require rebuilding it.

With the preview running, open <http://127.0.0.1:8765/tests/browser.html> and select **Run verification**. This runs in the same browser Python environment as the demo. It checks 708 comparisons against reference outputs: all eleven solution traces in both worlds including their initial states, plus every saved version on both fixed comparison scenes. The first map's traces were independently checked against the original research checkout; the other ten come from the bundled simulator, since the research checkout's simulator has since been refactored. It also checks all final wins, the two-rock push, rule-dependent victory, one mechanic per map at the step it happens (sinking, crabs and doors destroying themselves, melting, a transformation), map switching, the fixed comparison images, undo, the record of moves after an undo, the time guard on a runaway program, all 74 original program hashes, and that simulator imports come only from the bundled modules.

For an optional native Python check in an environment with NumPy and the bundled wheel dependencies installed:

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
