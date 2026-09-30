# Baba in Wonderland — project page

A static project page for [Baba in Wonderland](https://arxiv.org/abs/2605.16725), including three original playable puzzles, saved Python world models, and fixed failure/resolution examples. All game files live in this repository.

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
| `data/maps/make_a_way.json` | Warm-up: chain pushing and completing FLAG IS WIN; 17-step solution |
| `data/maps/double_crossing.json` | Two Crossings: sacrifice two rocks along the same river crossing; 24-step solution |
| `data/maps/remote_control.json` | Remote Control: transfer YOU to a rock, then move a key to open a door; 19-step solution |
| `data/aliases.json` | Wonderland property vocabulary from the experiment configuration |
| `data/examples.json` | Original simulator outputs used for the two fixed comparisons |
| `assets/` | Paper figures, original game sprites, and presentation assets |
| `runtime/game.py` | Map/session management and one-step prediction comparison |
| `runtime/vendor/` | Required simulator, serialization, and sandbox modules from the research repository |
| `runtime/wheels/` | Bundled Gym 0.25.2, gym-notices 0.0.8, and cloudpickle 3.1.1 wheels |
| `runtime/worker.js` | Browser Python initialization and message handling |
| `runtime/bundle.zip` | Prebuilt archive loaded by the worker |
| `runtime/provenance.json` | Original source commit, SHA-256 hashes, and documented adaptations |
| `tests/` | Original-runtime reference hashes and browser/native parity checks |

The 73 program files are byte-for-byte copies of the supplied versions. Their hashes are recorded in the provenance file and shown in the version selector's tooltip. `.gitattributes` preserves file bytes across Git checkouts without automatic line-ending conversion. The supplied files have no run metadata, so they are not asserted to be the exact checkpoints underlying the paper's tables.

The simulator comes from research-code commit `d683cccc52902218b55e49521c9a84226a72789d`. Its game rules are unchanged. Three packaging adaptations are documented: two package initializers omit training-only imports, and the map loader reads this repository's `data/maps` directory. Dependency wheels retain their bundled license files.

## Interactive demonstration

All three layouts were designed for this project page, rather than copied from original-game levels or paper evaluation maps. They retain the original artwork and game rules. Each map JSON contains its layout, a short objective, and a verified `solution` action list. Both latest supplied models predict every step of the three saved solutions correctly; this is a demonstration, not a measure of general performance on new maps.

The first puzzle introduces chain pushing and completing a rule. The second requires using both rocks to clear the same two-cell river crossing; wasting them in different rows leaves no complete path. The third requires moving YOU from BABA IS YOU to ROCK IS YOU across adjacent rows, controlling the rock in a sealed room, and positioning a key so OPEN and SHUT consume the key and door together.

Play opens on **Warm-up** at step zero in **Default World**, with the latest program `v021`. Wonderland starts with `v050`. Each world remembers its selected revision. The Map selector starts a new attempt on the chosen puzzle while preserving the world and program selection. Restart resets the selected map; undo never crosses map boundaries. Arrow keys/WASD move when the actual board is focused; Space waits, Z undoes, and R restarts. The source viewer offers the key function, complete original Python, and a diff against the previous saved revision in the same world. Copy code copies the complete source.

**Auto** resets the map to step zero and replays the selected map's recorded solution with a 250 ms pause between completed steps. This is a saved solution, not a policy generated by the selected model. A non-terminal prediction mismatch or model error pauses Auto before the next action. Red dashed outlines mark differing cells. Inspect or change the program, then **Continue** to acknowledge the mismatch and resume. **Stop** cancels future steps; an in-flight step may finish. Manual movement, Undo, or Restart leaves replay mode, so the next Auto starts from step zero. Playback also stops at a terminal state, the end of the recording, or an execution error.

Each prediction uses the actual pre-action state. Changing worlds or revisions re-predicts that same transition without advancing or resetting the game. Default World uses canonical property words; Wonderland uses remapped property words, mapped back only for display. Exact-state comparison includes object attributes and the terminal flag. These are one-step predictions, not accumulated model rollouts. Saved programs use the original restricted-builtins sandbox with a 1.5-second / 1,000,000-line execution limit. `v000` returns None and displays a prediction error after a move.

Above the game, two fixed Default World comparisons always use the first map: movement on the first RIGHT (`v001` fails, `v002` matches), and pushing a chain on the third RIGHT (`v002` fails, `v005` matches). The browser renders their saved states into images using the original sprites. The images do not change during play. These are illustrative replays, not evidence of historical training events on this map or full-benchmark accuracy. Revision numbers are run-specific, not aligned training steps or LLM-call counts.

## Updating and checking the package

After changing Python modules, programs, data, or parity fixtures, rebuild the browser archive:

```sh
python build_runtime.py
```

The build needs only the Python standard library and reads only this repository. Keep the generated `runtime/bundle.zip` with the source changes; the browser executes this archive. HTML, CSS, JavaScript, and asset-only edits do not require rebuilding it.

With the preview running, open <http://127.0.0.1:8765/tests/browser.html> and select **Run verification**. This runs in the same browser Python environment as the demo. It checks 272 comparisons against reference outputs: all three solution traces in both worlds including their initial states, plus every saved version on both fixed comparison scenes. The new maps' simulator traces were independently checked against the original research checkout. It also checks all final wins, the two-rock push, rule-dependent victory, the river sacrifices, remote control transfer, the key/door interaction, map switching, the fixed comparison images, undo, all 73 original program hashes, and that simulator imports come only from the bundled modules.

For an optional native Python check in an environment with NumPy, PyYAML, OpenCV, and the bundled wheel dependencies installed:

```sh
python -B tests/verify_runtime.py
```

## GitHub Pages

The repository is served directly as a [GitHub Pages static site](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), configured with **Settings → Pages → Deploy from a branch → main / (root)**. Publish updates by pushing the complete file tree and current prebuilt archive to `main`. `.nojekyll` preserves the Python package files. No backend, build workflow, or secret is required. Asset and worker paths are relative, including under `/BABAinWonderland_NeurIPS-26_Page/`.

## Sources and attribution

- [Paper](https://arxiv.org/abs/2605.16725) and the supplied manuscript/figures.
- [Research code](https://github.com/ssw03270/BABAinWonderland_NeurIPS-26).
- [Original Baba Is You on Steam](https://store.steampowered.com/app/736260/Baba_Is_You/).

Figures are rendered from the supplied original PDFs. Results are one-step state prediction accuracies, with online and held-out fixed-data evaluation separate. No conference acceptance claim is included.

The original Baba Is You game assets and level/map data are credited to the original game. We obtained permission from the game's developer to use these assets and map data for this research package. This repository does not grant separate rights to reuse the original game assets or map data outside the permitted research context; preserve this attribution and usage notice when sharing derived packages.

Questions about the paper or code: [SeungWon Seo](mailto:ssw03270@korea.ac.kr).
