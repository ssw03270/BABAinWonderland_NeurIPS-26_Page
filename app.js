const $ = (id) => document.getElementById(id);
document.querySelectorAll("[data-youtube]").forEach((button) => {
  button.addEventListener("click", () => {
    const frame = document.createElement("iframe");
    frame.src = `https://www.youtube-nocookie.com/embed/${button.dataset.youtube}?autoplay=1&rel=0&playsinline=1`;
    frame.title = button.getAttribute("aria-label");
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    button.replaceWith(frame);
  });
});
// The page's clips play like GIFs while on screen, from the start each time they come into view; a click pauses or
// resumes one.
const onScreen = new IntersectionObserver((entries) => entries.forEach(({target, isIntersecting}) => {
  if (isIntersecting) { target.currentTime = 0; target.play().catch(() => {}); } else target.pause();
}), {threshold: 0.5});
function watchClip(clip) {
  onScreen.observe(clip);
  clip.addEventListener("click", () => { if (clip.paused) clip.play().catch(() => {}); else clip.pause(); });
}
document.querySelectorAll("video.clip").forEach(watchClip);
$("copy-citation").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("bibtex").textContent);
    $("copy-citation").textContent = "Copied";
  } catch {
    $("copy-citation").textContent = "Select the text to copy";
  }
});

// Mean and standard deviation over 5 runs with GPT-5.4, from the NeurIPS 2026 rebuttal: online runs are evaluated on
// regular levels, fixed-data runs on held-out extra levels. A stat is [all accuracy, balanced accuracy, LLM calls],
// each a [mean, sd] pair (null: not reported); a row has one stat per world.
const BABA = ["Baba Is You words", "Baba in Wonderland words"];
const results = [
  {title: "Online learning (by playing)", worlds: BABA, rows: [
    ["WorldCoder", [[.871, .054], [.727, .160], [61.8, 21.5]], [[.542, .113], [.260, .126], [57.6, 5.5]]],
    ["Alice", [[.988, .008], [.990, .004], [19.8, 6.6]], [[.965, .054], [.951, .068], [94.0, 10.4]]],
  ], extra: [["WorldCoder, 100 calls †", null, [[.819, .052], [.658, .131], [100, 0]]]],
   note: "† WorldCoder kept going until the same 100-call cap as Alice instead of stopping early (a diagnostic run)."},
  {title: "Offline learning (given data, tested on new levels)", worlds: BABA, rows: [
    ["GIF-MCTS", [[.853, .046], [.754, .151], [100, 0]], [[.796, .065], [.716, .061], [100, 0]]],
    ["CWM", [[.964, .047], [.934, .058], [100, 0]], [[.845, .051], [.702, .149], [100, 0]]],
    ["Alice", [[1, 0], [1, 0], [21.4, 1.5]], [[.948, .038], [.920, .047], [91.8, 8.8]]],
  ]},
  {title: "ALFWorld: household tasks, online learning", worlds: ["ALFWorld"], rows: [
    ["WorldCoder", [[.702, .077], null, [100, 0]]],
    ["Alice", [[.962, .024], null, [34.4, 7.9]]],
  ]},
];
// Ablations, Baba in Wonderland, learning by playing: [the paper's name, what it changes in Alice, stat]
const ablations = [
  ["Alice", "", [[.965, .054], [.951, .068], [94.0, 10.4]]],
  ["Single-Class", "all past moves in one group", [[.890, .053], [.829, .073], [84.8, 20.9]]],
  ["Root-Class", "groups never split", [[.940, .052], [.906, .071], [80.0, 12.8]]],
  ["BFS", "breadth-first exploration", [[.901, .071], [.854, .105], [86.8, 18.6]]],
  ["w/o r_h", "exploration without novelty", [[.953, .044], [.924, .053], [83.0, 13.5]]],
  ["w/o r_C", "exploration without the rare-group bonus", [[.929, .050], [.890, .062], [87.0, 20.5]]],
];
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
// One panel per setting: a group of bars per world (its name under it), one bar per method, coloured by the method
// (Alice pink, the others greys), with its mean on top and a line for ± one standard deviation over the 5 runs.
const METHOD_CLASS = {Alice: "alice", WorldCoder: "worldcoder", "GIF-MCTS": "gifmcts", CWM: "cwm"};
const WORLD_LABEL = {"Baba Is You words": "Baba Is You", "Baba in Wonderland words": "Baba in Wonderland", ALFWorld: "ALFWorld"};
function barPanel({title, worlds, rows}) {
  const panel = el("figure", "bar-panel"), plot = el("div", "bar-plot");
  worlds.forEach((world, w) => {
    const group = el("div", "bar-group"), bars = el("div", "bar-row"), names = el("div", "bar-names");
    for (const [name, ...stats] of rows) {
      const [mean, sd] = stats[w][world === "ALFWorld" ? 0 : 1], slot = el("div", "bar-slot");
      const bar = el("div", `bar ${METHOD_CLASS[name]}`), spread = el("i", "spread"), value = el("span", "bar-value", `${Math.round(mean * 100)}%`);
      bar.style.height = `${mean * 100}%`;
      spread.style.bottom = `${Math.max(0, mean - sd) * 100}%`;
      spread.style.height = `${(Math.min(1, mean + sd) - Math.max(0, mean - sd)) * 100}%`;
      value.style.bottom = `${Math.min(1, mean + sd) * 100}%`;
      slot.title = `${name}, ${WORLD_LABEL[world]}: ${(mean * 100).toFixed(1)} ± ${(sd * 100).toFixed(1)}%`;
      slot.append(bar, spread, value);
      bars.append(slot);
      names.append(el("span", name === "Alice" ? "bar-name ours" : "bar-name", name));
    }
    group.append(bars, names, el("span", "bar-world", WORLD_LABEL[world]));
    plot.append(group);
  });
  const caption = el("figcaption");
  if (title.startsWith("ALFWorld")) {
    const house = el("img"), link = el("a", "", "ALFWorld"), clip = el("video", "clip alf-clip");
    Object.assign(house, {src: "assets/story/house.png", alt: "", width: 30, height: 27});
    Object.assign(link, {href: "https://alfworld.github.io/", target: "_blank", rel: "noopener"});
    caption.append(house, link, title.slice("ALFWorld".length));
    Object.assign(clip, {src: "assets/story/alfworld.mp4", poster: "assets/story/alfworld.webp", muted: true, loop: true, playsInline: true, preload: "none"});
    clip.setAttribute("aria-label", "An ALFWorld household: the agent opens the fridge and takes out a tomato.");
    watchClip(clip);
    plot.prepend(clip);
  } else caption.textContent = title;
  panel.append(caption, plot);
  return panel;
}
$("result-bars").replaceChildren(...results.map(barPanel));

// The full numbers, as the paper's tables (the ablations only here): per column the best accuracy in bold.
function statsTable(caption, groups, rows, note) {
  const table = el("table"), head = el("thead"), body = el("tbody");
  const columns = groups.flatMap(({label, cols}) => cols.map((col) => ({label, ...col})));
  table.append(el("caption", "", caption));
  if (groups.some(({label}) => label)) {
    const tr = el("tr");
    tr.append(el("th"));
    for (const {label, cols} of groups) { const th = el("th", "group", label || ""); th.colSpan = cols.length * 2; th.scope = "colgroup"; tr.append(th); }
    head.append(tr);
  }
  const tr = el("tr");
  tr.append(el("th", "", "Method"));
  for (const {name} of columns) { const th = el("th", "", name); th.colSpan = 2; tr.append(th); }
  head.append(tr);
  const best = columns.map(({get, higher}) => {
    const values = rows.map(({cells}) => get(cells)?.[0]).filter((v) => v !== undefined);
    return higher ? Math.max(...values) : null;
  });
  for (const {name, ours, cells} of rows) {
    const row = el("tr", ours ? "ours" : ""), method = el("th", "", name);
    method.scope = "row";
    row.append(method);
    columns.forEach(({get, scale}, c) => {
      const value = get(cells), mean = el("td", "mean"), sd = el("td", "sd");
      if (!value) mean.textContent = "–";
      else {
        mean.append(el(value[0] === best[c] ? "strong" : "span", "", (value[0] * scale).toFixed(1)));
        sd.textContent = `±${(value[1] * scale).toFixed(1)}`;
      }
      row.append(mean, sd);
    });
    body.append(row);
  }
  table.append(head, body);
  const figure = el("figure", "stats");
  figure.append(table);
  if (note) figure.append(el("figcaption", "", note));
  return figure;
}
const ACC = [{name: "All acc.", scale: 100, higher: true, k: 0}, {name: "Balanced acc.", scale: 100, higher: true, k: 1}, {name: "LLM calls", scale: 1, higher: false, k: 2}];
const worldCols = (w, keys = [0, 1, 2]) => ACC.filter(({k}) => keys.includes(k)).map(({name, scale, higher, k}) => ({name, scale, higher, get: (cells) => cells[w]?.[k]}));
$("result-tables").replaceChildren(
  ...results.map(({title, worlds, rows, extra = [], note}) => statsTable(title,
    worlds.length > 1 ? worlds.map((label, w) => ({label, cols: worldCols(w)})) : [{label: null, cols: worldCols(0, [0, 2])}],
    [...rows, ...extra].map(([name, ...cells]) => ({name, ours: name === "Alice", cells})), note)),
  statsTable("Ablations: Alice with one part changed (Baba in Wonderland, online learning)", [{label: null, cols: worldCols(0)}],
    ablations.map(([name, change, stat]) => ({name: change ? `${name}: ${change}` : name, ours: name === "Alice", cells: [stat]}))),
);

const canvas = $("game-canvas");
const predictionCanvas = $("prediction-canvas");
const runtime = new Worker(new URL("runtime/worker.js?v=c7f23e5a4b25", document.baseURI), {type:"module"});
const pendingRequests = new Map();
let requestId = 0, runtimeError = null;
runtime.addEventListener("message", ({data}) => {
  if (data.status) { if (!game) $("board-message").textContent = data.status; return; }
  const pending = pendingRequests.get(data.id);
  if (!pending) return;
  pendingRequests.delete(data.id);
  if (data.error) pending.reject(new Error(data.error));
  else pending.resolve(data.result);
});
runtime.addEventListener("error", () => {
  runtimeError = new Error("The interactive demo could not load. Reload to try again.");
  for (const pending of pendingRequests.values()) pending.reject(runtimeError);
  pendingRequests.clear();
});
function runtimeRequest(path, body) {
  if (runtimeError) return Promise.reject(runtimeError);
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    pendingRequests.set(id, {resolve, reject});
    runtime.postMessage({id, path, body});
  });
}
let game = null, busy = false, codeView = "diff", codeShown = "";
let verdicts = new Map();
let autoRunning = false, autoPaused = false, autoTimer = null;
// Sprites boil like the game's: every sprite is a sheet of its frames (assets/sprites/*/NAME.png, the Wonderland
// words included), and one clock picks the frame for all of them.
const SPRITE = 24, TILE = 48, BOIL_MS = 150;
let boil = 0;
const sheets = new Map();
function sheetFor(object, world, aliases) {
  const alias = world === "wonderland" && object.type === "rule_property" ? aliases[object.word] : null;
  const path = `assets/sprites/${object.type === "world_object" ? "icon" : "text"}/${(alias || object.word).toUpperCase()}.png`;
  if (!sheets.has(path)) {
    const img = new Image();
    img.onload = drawAll;
    img.src = path;
    sheets.set(path, img);
  }
  return sheets.get(path);
}
function drawObject(ctx, object, x, y, world, aliases) {
  const img = sheetFor(object, world, aliases);
  if (!img.complete || !img.naturalWidth) return;
  const sx = (boil % (img.naturalWidth / SPRITE)) * SPRITE;
  ctx.save();
  // Sprite artwork faces right; horizontal orientation is shown when present.
  if (object.type === "world_object" && object.direction === "facing left") { ctx.translate(x + TILE, y); ctx.scale(-1, 1); x = 0; y = 0; }
  ctx.drawImage(img, sx, 0, SPRITE, SPRITE, x, y, TILE, TILE);
  ctx.restore();
}
const exampleDrawers = [];
function drawAll() {
  if (game) drawBoards();
  exampleDrawers.forEach((draw) => draw());
}
setInterval(() => { boil = (boil + 1) % 3; drawAll(); }, BOIL_MS);
// Effects over a board, as the game shows them: sparkles from what is YOU on a win, a puff where a thing is destroyed;
// the game's board has its own, and so has the prediction's. They animate frame by frame while any is alive.
const effects = {game: [], prediction: [], hero: []}, EFFECT_MS = {spark: 1300, puff: 560};
let animating = false;
function addEffects(board, kind, cells) {
  const t0 = performance.now();
  for (const [x, y] of cells) effects[board].push({kind, x, y, t0});
  if (animating || !cells.length) return;
  animating = true;
  requestAnimationFrame(function tick() {
    drawAll();
    if (Object.values(effects).some((list) => list.length)) requestAnimationFrame(tick); else animating = false;
  });
}
const effectsOn = (board) => (ctx, cell) => {
  const now = performance.now(), list = effects[board];
  for (let i = list.length - 1; i >= 0; i--) {
    const {kind, x, y, t0} = list[i], p = (now - t0) / EFFECT_MS[kind];
    if (p >= 1) { list.splice(i, 1); continue; }
    const [px, py] = cell(x, y), cx = px + TILE / 2, cy = py + TILE / 2, spark = kind === "spark", n = spark ? 12 : 8;
    ctx.fillStyle = spark ? "#ede285" : "#d6d6dc";
    ctx.globalAlpha = 1 - p * p;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + (spark ? p * 1.4 : .3);
      const r = TILE * (spark ? .3 + 1.7 * p : .15 + .55 * p), size = Math.round((spark ? 9 : 10) * (1 - p) + 3);
      ctx.fillRect(Math.round(cx + Math.cos(a) * r - size / 2), Math.round(cy + Math.sin(a) * r - size / 2), size, size);
    }
    ctx.globalAlpha = 1;
  }
};
// The things a move destroyed: world objects whose count went down, where they were.
function destroyed(before, after) {
  const byWord = (board) => {
    const m = new Map();
    for (const o of board.objects) if (o.type === "world_object") m.set(o.word, [...(m.get(o.word) || []), o.position.join(",")]);
    return m;
  };
  const was = byWord(before), now = byWord(after), gone = [];
  for (const [word, places] of was) {
    const left = now.get(word) || [];
    let missing = places.length - left.length;
    for (const p of places) if (missing > 0 && !left.includes(p)) { gone.push(p.split(",").map(Number)); missing--; }
  }
  return gone;
}
const youCells = (board) => {
  const you = youWords(board);
  return board.objects.filter((o) => o.type === "world_object" && you.has(o.word)).map((o) => o.position);
};
// A won board: the step ended with something that is YOU on something that is WIN.
function wins(board) {
  if (!board.step?.terminated) return false;
  const win = youWords(board, "win"), you = new Set(youCells(board).map((p) => p.join(",")));
  return board.objects.some((o) => o.type === "world_object" && win.has(o.word) && you.has(o.position.join(",")));
}
// The prediction's effects, when a prediction is shown: puffs where it destroys things, sparkles if it wins.
function predictionEffects() {
  const predicted = game.comparison?.[game.world]?.board;
  if (!predicted || !game.before) return;
  addEffects("prediction", "puff", destroyed(game.before, predicted));
  if (wins(predicted)) addEffects("prediction", "spark", youCells(predicted));
}

function drawBoards() {
  if (!game) return;
  const prediction = game.comparison?.[game.world];
  const objects = [...game.board.objects, ...(prediction?.board?.objects || [])];
  const [width, height] = game.board.grid_size;
  // Both views use the same camera, so a difference never moves the frame.
  const xs = objects.map((o) => o.position[0]), ys = objects.map((o) => o.position[1]);
  const x0 = objects.length ? Math.max(0, Math.min(...xs) - 2) : 0;
  const y0 = objects.length ? Math.max(0, Math.min(...ys) - 2) : 0;
  const x1 = objects.length ? Math.min(width - 1, Math.max(...xs) + 2) : width - 1;
  const y1 = objects.length ? Math.min(height - 1, Math.max(...ys) + 2) : height - 1;
  const frame = {x0,y0,x1,y1};
  drawBoard(canvas, game.board, frame, prediction?.cells || [], game.world, game.aliases, effectsOn("game"));
  drawBoard(predictionCanvas, prediction?.board || {objects:[]}, frame, prediction?.cells || [], game.world, game.aliases, effectsOn("prediction"));
}

// ``overlay(ctx, cell)`` draws on top; ``cell(x, y)`` is a grid cell's top-left pixel.
function drawBoard(canvas, board, {x0,y0,x1,y1}, differingCells, world = "default", aliases = {}, overlay = null) {
  const ctx = canvas.getContext("2d");
  const width = (x1 - x0 + 1) * TILE, height = (y1 - y0 + 1) * TILE;
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const cell = (x, y) => [(x - x0) * TILE, (y - y0) * TILE];
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#101012"; ctx.fillRect(0, 0, width, height);
  // Floor first, rule words last; what is YOU above the other things, so a wrong prediction that puts it inside a wall
  // still shows it.
  const you = youWords(board);
  const layer = (o) => o.word === "tile" ? -1 : o.type !== "world_object" ? 2 : you.has(o.word) ? 1 : 0;
  for (const object of [...board.objects].sort((a, b) => layer(a) - layer(b))) drawObject(ctx, object, ...cell(...object.position), world, aliases);
  overlay?.(ctx, cell);
  ctx.strokeStyle = "#ff5b62"; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
  for (const [x, y] of differingCells) { const [px, py] = cell(x, y); ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4); }
  ctx.setLineDash([]);
}

// What is YOU (or another property) on a board: the nouns of the rules "NOUN IS YOU", read across and down as the
// game does.
function youWords(board, property = "you") {
  const text = new Map(board.objects.filter((o) => o.type !== "world_object").map((o) => [o.position.join(","), o.word]));
  const at = (x, y) => text.get(`${x},${y}`);
  const words = new Set();
  for (const [key, word] of text) {
    if (word !== "is") continue;
    const [x, y] = key.split(",").map(Number);
    if (at(x + 1, y) === property && at(x - 1, y)) words.add(at(x - 1, y));
    if (at(x, y + 1) === property && at(x, y - 1)) words.add(at(x, y - 1));
  }
  return words;
}
const STEP = {right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1]};
// The examples' marks: the key pressed (an arrow from what is YOU), where things really went that the wrong
// prediction misses (faded), and the cells a fix got right (green).
const marks = {
  arrow: (board, action) => (ctx, cell) => {
    const [dx, dy] = STEP[action];
    const you = youWords(board);
    ctx.fillStyle = ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.lineCap = "round";
    for (const o of board.objects.filter((o) => o.type === "world_object" && you.has(o.word))) {
      const [px, py] = cell(...o.position), cx = px + TILE / 2, cy = py + TILE / 2;
      const [ax, ay, bx, by] = [cx + dx * TILE * .58, cy + dy * TILE * .58, cx + dx * TILE * 1.2, cy + dy * TILE * 1.2];
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + dx * 12, by + dy * 12); ctx.lineTo(bx - dy * 11, by + dx * 11); ctx.lineTo(bx + dy * 11, by - dx * 11); ctx.fill();
    }
  },
  ghosts: (actual, predicted, cells) => (ctx, cell) => {
    const wrong = new Set(cells.map((c) => c.join(",")));
    const shown = new Set(predicted.objects.map((o) => `${o.word}@${o.position.join(",")}`));
    ctx.globalAlpha = .42;
    for (const o of actual.objects.filter((o) => o.type === "world_object" && wrong.has(o.position.join(",")) && !shown.has(`${o.word}@${o.position.join(",")}`))) drawObject(ctx, o, ...cell(...o.position), "default", {});
    ctx.globalAlpha = 1;
  },
  right: (cells) => (ctx, cell) => {
    ctx.strokeStyle = "#4fd58a"; ctx.lineWidth = 3;
    for (const [x, y] of cells) { const [px, py] = cell(x, y); ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4); }
  },
};
// Each story steps through one picture: the move pressed, the older version's wrong prediction, the newer version's
// right one; the bar under it shows the step, its line says what the picture shows and the code line behind it.
const STORY_MS = 2200;
const STORIES = {
  wall: [
    {shot: "before", text: "Baba presses ↑ under a wall."},
    {shot: "failed", text: "v002 predicts Baba walks into the wall.", code: "obj['position'] = new_position"},
    {shot: "fixed", text: "v003 predicts Baba stays, as in the game.", code: "if _blocked_by_stop(…): continue"},
  ],
  push: [
    {shot: "before", text: "Baba presses → next to two rocks."},
    {shot: "failed", text: "v002 predicts Baba walks onto the rock.", code: "obj['position'] = new_position"},
    {shot: "fixed", text: "v005 predicts the whole chain moves, as in the game.", code: "_attempt_move(blocker, …)"},
  ],
};
const stories = [];
function showStep(story, k) {
  story.step = k;
  story.since = performance.now();
  const {shot, text, code} = STORIES[story.scene][k], verdict = {failed: "no", fixed: "yes"}[shot];
  story.steps.forEach((step, n) => step.classList.toggle("active", n === k));
  story.badge.hidden = !verdict;
  story.badge.className = `story-badge ${verdict || ""}`;
  story.badge.textContent = verdict === "no" ? "✗" : "✓";
  story.caption.replaceChildren(el("span", "", text), ...(code ? [el("code", verdict, code)] : []));
  story.draw();
}
setInterval(() => {
  for (const story of stories) if (performance.now() - story.since >= STORY_MS) showStep(story, (story.step + 1) % 3);
}, 200);
async function renderExamples() {
  try {
    const response = await fetch("data/examples.json?v=60a584330560");
    if (!response.ok) throw new Error("Comparison images could not be loaded.");
    const {examples} = await response.json();
    for (const example of examples) {
      const xs = example.failed.cells.map(cell => cell[0]), ys = example.failed.cells.map(cell => cell[1]);
      const [width, height] = example.before.grid_size;
      // The changed cells and one around them, at least three cells each way.
      const span = (lo, hi, size) => {
        let a = Math.max(0, lo - 1), b = Math.min(size - 1, hi + 1);
        while (b - a < 2) { if (a > 0) a--; else if (b < size - 1) b++; else break; }
        return [a, b];
      };
      const [x0, x1] = span(Math.min(...xs), Math.max(...xs), width), [y0, y1] = span(Math.min(...ys), Math.max(...ys), height);
      const frame = {x0, y0, x1, y1};
      const shots = {
        before: [example.before, [], marks.arrow(example.before, example.action)],
        failed: [example.failed.board, example.failed.cells, marks.ghosts(example.actual, example.failed.board, example.failed.cells)],
        fixed: [example.fixed.board, [], marks.right(example.failed.cells)],
      };
      const card = document.querySelector(`.story[data-case="${example.scene}"]`), canvas = card.querySelector("canvas");
      const story = {scene: example.scene, badge: card.querySelector(".story-badge"), caption: card.querySelector(".story-caption")};
      story.steps = STORIES[example.scene].map((_, k) => {
        const step = el("li"), button = el("button");
        button.setAttribute("aria-label", `Step ${k + 1}`);
        button.addEventListener("click", () => showStep(story, k));
        step.append(button);
        return step;
      });
      card.querySelector(".story-steps").replaceChildren(...story.steps);
      story.draw = () => {
        const [board, cells, overlay] = shots[STORIES[example.scene][story.step].shot];
        drawBoard(canvas, board, frame, cells, "default", {}, overlay);
      };
      stories.push(story);
      exampleDrawers.push(() => story.draw());
      showStep(story, 0);
    }
    $("failure-examples").hidden = false;
    $("example-status").hidden = true;
  } catch (error) {
    $("example-status").textContent = "The comparison images could not load. Reload to try again.";
  }
}

// The prediction's verdict in a few words: the cells it gets wrong; when every cell is right, the win it misses or
// predicts (a game here ends only in a win: DEFEAT removes what is YOU and play goes on).
function verdictText(prediction) {
  if (!prediction) return "make a move";
  if (prediction.error) return "✗ error";
  if (prediction.match) return "✓ same as the game";
  const n = prediction.cells.length;
  if (n) return `✗ ${n} ${n === 1 ? "cell differs" : "cells differ"}`;
  if (!prediction.terminationMatch) return prediction.board.step?.terminated ? "✗ predicts a win" : "✗ misses the win";
  return "✗ state differs";
}
function renderComparison() {
  const prediction = game.comparison?.[game.world];
  $("prediction-message").hidden = Boolean(prediction?.board);
  $("prediction-message").textContent = prediction?.error ? game.program.version === game.versions[0] ? "The first saved code returns no state." : "This version's code fails on this move." : "Make a move to see a prediction.";
  $("prediction-result").textContent = verdictText(prediction);
  $("prediction-result").dataset.match = prediction ? String(prediction.match) : "pending";
  drawBoards();
}

// Alice's code beside the boards. Above it, every saved version as a square: green if that version predicts the last
// move right, red if not. After a move the version that last fixed it is picked; picking another shows its
// prediction on the right (named by its version) and its code. "What changed" is the picked version's difference
// from the one before it, "Full code" the whole file.
// "What changed", read like a review: the changed lines grouped under the function they sit in (a new function
// marked new), added lines green, removed ones red, with the new file's line numbers.
function diffRows(program) {
  const source = program.source.split("\n"), rows = [], functions = new Map();
  const functionAt = (line) => {
    for (let n = line; n >= 1; n--) { const m = /^def (\w+)/.exec(source[n - 1] || ""); if (m) return m[1]; }
    return "top of the file";
  };
  let line = 0, current = null, added = 0, removed = 0, skipped = false;
  for (const text of program.diff.split("\n")) {
    if (text.startsWith("---") || text.startsWith("+++")) continue;
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(text);
    if (hunk) { line = Number(hunk[1]); skipped = rows.length > 0; continue; }
    const kind = text[0] === "+" ? "added" : text[0] === "-" ? "removed" : "context", body = text.slice(1);
    const opens = kind === "added" ? /^def (\w+)/.exec(body) : null, name = opens ? opens[1] : functionAt(Math.max(1, line));
    if (opens) functions.set(name, "new");
    else if (kind !== "context" && !functions.has(name)) functions.set(name, "changed");
    if (name !== current) rows.push({kind: "function", name});
    else if (skipped) rows.push({text: "⋯", kind: "context"});
    current = name;
    skipped = false;
    rows.push({text: body, kind, line: kind === "removed" ? "–" : line});
    if (kind === "added") added++;
    if (kind === "removed") removed++;
    if (kind !== "removed") line++;
  }
  for (const row of rows) if (row.kind === "function") Object.assign(row, {text: row.name, fresh: functions.get(row.name) === "new"});
  diffRows.changes = {added, removed, functions};
  // a function whose lines only show as context around a change elsewhere is left out
  let shown = true;
  const changed = rows.filter((row) => (shown = row.kind === "function" ? functions.has(row.name) : shown));
  return changed;
}
// The code box's head: beside its tabs, how many lines the picked version added and removed (or, for the full code,
// how long it is); under them, in "What changed", the functions it changed and the ones it added. A function's name
// jumps the code to it, and the one in view is marked as the code scrolls.
function renderChanges() {
  const changes = $("code-changes"), counts = $("code-counts"), program = game.program;
  changes.hidden = codeView !== "diff";
  if (codeView !== "diff") { counts.replaceChildren(`${program.lines} lines`); return; }
  const {added, removed, functions} = diffRows.changes;
  if (program.previous) counts.replaceChildren(el("span", "add", `+${added}`), el("span", "del", `−${removed}`), `vs ${program.previous}`);
  else counts.replaceChildren(el("span", "add", `+${added}`), "the first saved code");
  const groups = ["changed", "new"].map((how) => {
    const names = [...functions].filter(([, kind]) => kind === how).map(([name]) => name);
    if (!names.length) return null;
    const group = el("div", `fn-group ${how}`), list = el("span", "fns");
    list.append(...names.map((name) => { const chip = el("button", "fn", name); chip.dataset.fn = name; return chip; }));
    group.append(el("span", "fn-label", how), list);
    return group;
  }).filter(Boolean);
  changes.replaceChildren(...groups);
}
function markFunctionInView() {
  const pre = $("program-source").parentElement, top = pre.getBoundingClientRect().top + 24;
  let inView = null;
  for (const row of pre.querySelectorAll(".source-line[data-fn]")) {
    if (inView && row.getBoundingClientRect().top > top) break;
    inView = row.dataset.fn;
  }
  for (const chip of $("code-changes").querySelectorAll("button[data-fn]")) chip.setAttribute("aria-current", String(chip.dataset.fn === inView));
}
function renderCode() {
  const program = game.program;
  codeShown = `${game.world}/${program.version}`;
  const rows = codeView === "diff" ? diffRows(program) : program.source.split("\n").map((text, i) => ({text, line: i + 1}));
  renderChanges();
  $("program-source").replaceChildren(...rows.map(({text, line, kind, name, fresh}) => {
    const span = el("span", kind ? `source-line ${kind}` : "source-line", text || " ");
    if (line) span.dataset.line = line;
    if (kind === "function") { span.dataset.fn = name; if (fresh) span.append(el("b", "", "new")); }
    return span;
  }));
  const pre = $("program-source").parentElement;
  pre.scrollLeft = 0;
  pre.scrollTop = 0;
  markFunctionInView();
  $("copy-program").textContent = "Copy";
}
function renderStrip() {
  const strip = $("versions");
  if (strip.dataset.world !== game.world || strip.children.length !== game.versions.length) {
    strip.dataset.world = game.world;
    strip.dataset.first = game.versions[0];
    strip.dataset.last = game.versions.at(-1);
    strip.replaceChildren(...game.versions.map((version, k) => {
      const button = el("button");
      button.dataset.version = version;
      button.style.setProperty("--k", k);
      return button;
    }));
  }
  // the picked square again, big, right above the code (its version ringed green or red, and its verdict), and on
  // the prediction it makes
  let before;
  const picked = game.program.version;
  for (const button of strip.children) {
    const version = button.dataset.version, verdict = verdicts.get(version);
    // a version that gets the move right right after one that got it wrong: where the code was fixed, named
    const fixed = verdict === true && before === false;
    const state = verdict === undefined ? "" : verdict ? (fixed ? "fixed" : "right") : "wrong";
    button.className = fixed ? "right fixed" : state;
    button.dataset.tag = fixed ? version : "";
    button.title = verdict === undefined ? version : `${version}: ${verdict ? "right" : "wrong"} on this move`;
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(version === picked));
    if (version === picked) {
      for (const badge of [$("code-version"), $("predict-version")]) {
        badge.textContent = version;
        badge.dataset.verdict = state || "pending";
      }
      $("code-verdict").textContent = {fixed: "fixes this move", right: "right on this move", wrong: "wrong on this move"}[state] || "";
    }
    before = verdict;
  }
}
// The verdicts sweep in as a wave, from the first saved version to the latest (the pick already made).
function wave() {
  const strip = $("versions");
  strip.classList.remove("wave");
  void strip.offsetWidth;
  strip.classList.add("wave");
}
// The moves so far: one token per move with its arrow, its bar green where the picked version of the code predicted it
// right and red where not; a new pick recolours the whole record.
// A drawn arrow (or a dot for waiting), rotated for the move.
const TURN = {up: 0, right: 90, down: 180, left: 270};
function arrowIcon(action) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const shape = document.createElementNS("http://www.w3.org/2000/svg", action === "idle" ? "circle" : "path");
  if (action === "idle") { shape.setAttribute("cx", "12"); shape.setAttribute("cy", "12"); shape.setAttribute("r", "3"); }
  else { shape.setAttribute("d", "M12 4 19 12h-4.5v8h-5v-8H5z"); shape.setAttribute("transform", `rotate(${TURN[action]} 12 12)`); }
  svg.append(shape);
  return svg;
}
let trailToken = 0;
async function refreshTrail() {
  const token = ++trailToken;
  try {
    const {trail} = await runtimeRequest("/trail");
    if (token !== trailToken) return;
    const box = $("trail");
    box.replaceChildren(...trail.map(({action, match}, k) => {
      const move = el("li", match ? "right" : "wrong");
      move.append(arrowIcon(action));
      move.title = `Step ${k + 1}: ${action}, ${match ? "right" : "wrong"} in ${game.program.version}`;
      return move;
    }));
    box.scrollTop = box.scrollHeight;
  } catch { /* the record stays as it was */ }
}
// What the board itself shows instead of instructions: the arrow keys before the first move, WIN when won, the way
// back (undo, restart) when an attempt has ended.
function renderOverlay() {
  const overlay = $("game-overlay");
  const keyRow = (pairs) => {
    const row = el("span", "keys");
    for (const [key, label] of pairs) { row.append(el("kbd", "", key)); if (label) row.append(el("span", "key-label", label)); }
    return row;
  };
  const winTile = () => {
    const win = el("i", "tile win");
    win.style.backgroundImage = "url(assets/sprites/text/WIN.png)";
    return win;
  };
  const signs = {won: () => [winTile(), keyRow([["R", "play again"]])], ended: () => [keyRow([["Z", "undo"], ["R", "restart"]])]};
  // the prediction shows the game's signs for the state it predicts: a predicted win, a predicted end
  const predicted = game.comparison?.[game.world]?.board;
  const predictedState = !predicted?.step?.terminated ? "" : wins(predicted) ? "won" : "ended";
  $("prediction-overlay").dataset.state = predictedState;
  $("prediction-overlay").replaceChildren(...(predictedState ? signs[predictedState]() : []));
  let state = "", parts = [];
  if (game.won) {
    state = "won";
    parts = signs.won();
  } else if (game.ended) {
    state = "ended";
    parts = signs.ended();
  } else if (game.steps === 0 && !autoRunning) {
    state = "start";
    parts = [keyRow([["←"], ["↑"], ["↓"], ["→"]])];
  }
  overlay.dataset.state = state;
  overlay.replaceChildren(...parts);
}

function renderVersions() {
  document.querySelectorAll("[data-world]").forEach(button => button.setAttribute("aria-pressed",String(button.dataset.world === game.world)));
  if (codeShown !== `${game.world}/${game.program.version}`) renderCode();
  renderStrip();
  if ($("map-select").options.length !== game.maps.length) $("map-select").replaceChildren(...game.maps.map((map, i) => new Option(`${i + 1} · ${map.label}`, map.id)));
  $("map-select").value = game.map;
  $("map-objective").textContent = game.objective;
}

function setControls() {
  document.querySelectorAll("[data-action]").forEach((button) => { button.disabled = busy || autoRunning || !game || game.ended; });
  $("undo").disabled = busy || autoRunning || !game?.canUndo;
  $("restart").disabled = busy || autoRunning || !game;
  document.querySelectorAll("[data-world]").forEach(button => { button.disabled = busy || autoRunning || !game; });
  $("map-select").disabled = busy || autoRunning || !game;
  $("auto-play").disabled = !autoRunning && (busy || !game);
  $("auto-play").textContent = autoRunning ? `■ ${game.steps} / ${game.solution.length}` : autoPaused ? "▶ Continue" : "▶ Auto";
  $("auto-play").title = autoPaused ? "Continue the saved solution from this step" : "Replay the saved solution from step 0";
  $("auto-play").setAttribute("aria-pressed", String(autoRunning));
  $("copy-program").disabled = !game;
  $("game-shell").setAttribute("aria-busy", String(busy));
}
function renderGame() {
  $("step-count").textContent = game.steps;
  $("step-unit").textContent = game.steps === 1 ? "step" : "steps";
  $("board-message").hidden = true;
  renderVersions(); renderComparison(); renderOverlay(); setControls();
}
// The version that last fixed a move: the first of the latest run of versions that get it right (the one after the
// last version that got it wrong); none if no version gets it right.
function lastFix(judged) {
  let k = judged.findLastIndex(({match}) => match);
  if (k < 0) return null;
  while (k > 0 && judged[k - 1].match) k--;
  return judged[k].version;
}
// One request to the runtime and what follows from it. After a request that leaves a last move to judge (a move, an
// undo, a world switch), every version's verdict on it is fetched and the version that last fixed it is picked (its
// code and its prediction shown) before the strip's wave plays; a picked square only changes the pick.
async function gameRequest(path = "", body) {
  if (busy) return;
  if (!autoRunning && ["/action", "/reset", "/undo"].includes(path)) autoPaused = false;
  busy = true; setControls();
  const before = game;
  try {
    let next = await runtimeRequest(path, body), judged = null;
    if (path !== "/version") {
      judged = next.comparison ? (await runtimeRequest("/verdicts")).verdicts : [];
      const fix = lastFix(judged);
      if (fix && fix !== next.program.version) next = await runtimeRequest("/version", {version: fix});
      verdicts = new Map(judged.map(({version, match}) => [version, match]));
    }
    game = next; renderGame();
    if (path === "/action") {
      addEffects("game", "puff", destroyed(before.board, game.board));
      if (game.won && !before.won) addEffects("game", "spark", youCells(game.board));
    }
    if (path === "/action" || path === "/version") predictionEffects();
    if (judged?.length && !autoRunning) wave();
    refreshTrail();
    return true;
  } catch (error) {
    $("board-message").hidden = false;
    $("board-message").textContent = game ? error.message : "The interactive demo could not load. Reload to try again.";
    return false;
  } finally { busy=false; setControls(); }
}

function stopAuto() {
  autoRunning = false; autoPaused = false;
  clearTimeout(autoTimer); autoTimer = null;
  setControls();
  if (game) renderOverlay();
}
function scheduleAuto() {
  if (!autoRunning) return;
  if (game.ended || game.steps >= game.solution.length) { stopAuto(); return; }
  autoTimer = setTimeout(async () => {
    autoTimer = null;
    if (!autoRunning) return;
    if (!await gameRequest("/action", {action:game.solution[game.steps]})) { stopAuto(); return; }
    if (!autoRunning) return;
    if (!game.ended && !game.comparison[game.world].match) {  // no saved version explains this move: a pause on it
      autoRunning = false; autoPaused = true;
      renderGame();
      wave();
      return;
    }
    scheduleAuto();
  }, 250);
}
$("auto-play").addEventListener("click", async () => {
  if (autoRunning) { stopAuto(); return; }
  if (busy || !game) return;
  const resume = autoPaused;
  autoPaused = false; autoRunning = true; setControls();
  if (!resume && !await gameRequest("/reset", {map:game.map})) { stopAuto(); return; }
  scheduleAuto();
});
document.querySelectorAll("[data-world]").forEach(button => button.addEventListener("click", () => gameRequest("/world",{world:button.dataset.world})));
// A changed menu lets go of the keys at once, so the next arrow key moves Baba instead of the menu's choice.
$("versions").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-version]");
  if (button) { button.blur(); gameRequest("/version", {version: button.dataset.version}); }
});
$("code-changes").addEventListener("click", (event) => {
  const chip = event.target.closest("button[data-fn]");
  if (!chip) return;
  chip.blur();
  const pre = $("program-source").parentElement, row = pre.querySelector(`.source-line[data-fn="${chip.dataset.fn}"]`);
  pre.scrollTo({top: pre.scrollTop + row.getBoundingClientRect().top - pre.getBoundingClientRect().top - 8, behavior: "smooth"});
});
$("program-source").parentElement.addEventListener("scroll", markFunctionInView, {passive: true});
$("map-select").addEventListener("change", () => { $("map-select").blur(); gameRequest("/reset",{map:$("map-select").value}); });
document.querySelectorAll("[data-code-view]").forEach(button => button.addEventListener("click", () => {
  codeView = button.dataset.codeView;
  document.querySelectorAll("[data-code-view]").forEach(other => other.setAttribute("aria-pressed",String(other===button)));
  renderCode();
}));
$("copy-program").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(game.program.source); $("copy-program").textContent = "Copied"; }
  catch { $("copy-program").textContent = "Select Full code to copy"; }
});
document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
  button.blur();
  gameRequest("/action",{action:button.dataset.action});
}));
$("undo").addEventListener("click", () => gameRequest("/undo",{}));
$("restart").addEventListener("click", () => gameRequest("/reset",{map:game.map}));
// The keys play the game while the pointer is on it, or after a click (or Tab) into it until one elsewhere; they then
// never scroll the page or move between its controls.
const shell = $("game-shell");
let pointerOn = false, clickedIn = false;
const keysOn = () => pointerOn || clickedIn;
const showKeys = () => shell.classList.toggle("keys-on", keysOn());
shell.addEventListener("pointerenter", () => { pointerOn = true; showKeys(); });
shell.addEventListener("pointerleave", () => { pointerOn = false; showKeys(); });
document.addEventListener("pointerdown", (event) => { clickedIn = shell.contains(event.target); showKeys(); });
shell.addEventListener("focusin", () => { clickedIn = true; showKeys(); });
const ACTIONS = {arrowup:"up",w:"up",arrowright:"right",d:"right",arrowdown:"down",s:"down",arrowleft:"left",a:"left"," ":"idle"};
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (!keysOn() || !game || event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.("select")) return;
  if (!ACTIONS[key] && key !== "r" && key !== "z") return;
  event.preventDefault();
  if (shell.contains(document.activeElement)) document.activeElement.blur();
  if (event.repeat || busy || autoRunning) return;
  if (key === "z" && game.canUndo) gameRequest("/undo",{});
  else if (key === "r") gameRequest("/reset",{map:game.map});
  else if (ACTIONS[key] && !game.ended) gameRequest("/action",{action:ACTIONS[key]});
});
// The stage's little level, played as the game plays it: Baba pushes FLAG IS against WIN (the rule lights up with a
// pop), steps down and walks to the flag, one tile a step with a hop; on the flag, WIN's sparkles and happy hops; then
// it starts over. The canvas has a tile of room around the level for the sparkles.
(function heroLevel() {
  const canvas = $("hero-walk"), ctx = canvas.getContext("2d");
  const LEVEL = [
    {type: "world_object", word: "baba", position: [0, 0]}, {type: "rule_noun", word: "flag", position: [1, 0]},
    {type: "rule_operator", word: "is", position: [2, 0]}, {type: "rule_property", word: "win", position: [4, 0]},
    {type: "world_object", word: "flag", position: [7, 1]},
  ];
  const MOVES = ["right", "down", "right", "right", "right", "right", "right", "right"];
  const STEP_MS = 260, SLIDE_MS = 120, START_MS = 500, RULE_MS = 450, WIN_MS = 1100, FADE_MS = 300;
  // every state, one per move: Baba moves a tile, pushing the words in front of it (a flag is not pushed)
  const states = [LEVEL];
  for (const move of MOVES) {
    const now = states.at(-1).map((o) => ({...o, position: [...o.position]})), [dx, dy] = STEP[move];
    const at = (x, y) => now.find((o) => o.type !== "world_object" && o.position[0] === x && o.position[1] === y);
    const baba = now[0], chain = [];
    for (let x = baba.position[0] + dx, y = baba.position[1] + dy, o; (o = at(x, y)); x += dx, y += dy) chain.push(o);
    for (const o of [baba, ...chain]) o.position = [o.position[0] + dx, o.position[1] + dy];
    states.push(now);
  }
  const begin = MOVES.map((_, k) => START_MS + k * STEP_MS + (k > 0 ? RULE_MS : 0));  // (a pause as the rule lights up)
  const won = begin.at(-1) + SLIDE_MS, CYCLE = begin.at(-1) + STEP_MS + WIN_MS + FADE_MS;
  const cell = (x, y) => [(x + 1) * TILE, (y + 1) * TILE];
  const t0 = performance.now();
  let shown = true, cycle = -1, sparked = false;
  new IntersectionObserver(([entry]) => { shown = entry.isIntersecting; }).observe(canvas);
  requestAnimationFrame(function frame(now) {
    requestAnimationFrame(frame);
    if (!shown) return;
    const elapsed = now - t0, t = elapsed % CYCLE;
    if (Math.floor(elapsed / CYCLE) !== cycle) { cycle = Math.floor(elapsed / CYCLE); sparked = false; }
    const k = begin.findLastIndex((b) => t >= b), u = k < 0 ? 0 : Math.min(1, (t - begin[k]) / SLIDE_MS);
    const from = states[k < 0 ? 0 : k], to = states[k < 0 ? 0 : k + 1], e = 1 - (1 - u) ** 3;
    const lit = t >= begin[0] + SLIDE_MS, pop = lit ? .18 * Math.sin(Math.PI * Math.min(1, (t - begin[0] - SLIDE_MS) / 260)) : 0;
    if (t >= won && !sparked) { sparked = true; addEffects("hero", "spark", [to[0].position]); }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1 - Math.min(1, Math.max(0, t - (CYCLE - FADE_MS)) / FADE_MS);
    const place = (o, j) => cell(from[j].position[0] + (o.position[0] - from[j].position[0]) * e, from[j].position[1] + (o.position[1] - from[j].position[1]) * e);
    // the flag and the words (dim until they form a rule, as the game shows them), then Baba: a hop each step, a
    // squash as it lands, and on the flag two happy hops
    for (const j of [4, 1, 2, 3]) {
      const [x, y] = place(to[j], j), grow = j < 4 ? pop : 0;
      ctx.save();
      if (j < 4) ctx.globalAlpha *= lit ? 1 : .45;
      ctx.translate(x + TILE / 2, y + TILE / 2);
      ctx.scale(1 + grow, 1 + grow);
      drawObject(ctx, to[j], -TILE / 2, -TILE / 2, "default", {});
      ctx.restore();
    }
    const landed = k < 0 ? 1 : (t - begin[k] - SLIDE_MS) / 90, happy = t >= won ? (t - won) / 520 : 0;
    const lift = k >= 0 && u < 1 ? 7 * Math.sin(Math.PI * u) : happy > 0 && happy < 2 ? 12 * Math.abs(Math.sin(Math.PI * happy)) : 0;
    const squash = landed > 0 && landed < 1 ? .1 * Math.sin(Math.PI * landed) : 0;
    const [bx, by] = place(to[0], 0);
    ctx.save();
    ctx.translate(bx + TILE / 2, by + TILE - lift);
    ctx.scale(1 + squash, 1 - squash);
    drawObject(ctx, to[0], -TILE / 2, -TILE, "default", {});
    ctx.restore();
    effectsOn("hero")(ctx, cell);
    ctx.globalAlpha = 1;
  });
})();
gameRequest();
renderExamples();
